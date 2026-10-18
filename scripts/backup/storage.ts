import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { createWriteStream } from "node:fs";
import {
  authenticateManifest,
  BackupError,
  canonical,
  MAX_BYTES,
  type Manifest,
  readManifest,
  requireCheck,
  verifyFile,
} from "./core";

export function r2Config(
  env: Record<string, string | undefined> = process.env,
) {
  for (const k of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
  ])
    requireCheck(env[k]?.trim(), "R2_CONFIG_MISSING");
  let endpoint: URL;
  try {
    endpoint = new URL(env.R2_ENDPOINT!);
  } catch {
    throw new BackupError("R2_ENDPOINT_INVALID");
  }
  requireCheck(
    /^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID!) &&
      endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.port &&
      !endpoint.search &&
      !endpoint.hash &&
      endpoint.pathname === "/" &&
      ["", "eu.", "fedramp."].some(
        (j) =>
          endpoint.hostname ===
          `${env.R2_ACCOUNT_ID}.${j}r2.cloudflarestorage.com`,
      ) &&
      env.R2_BUCKET === "pusula-backups-development",
    "R2_TARGET_REJECTED",
  );
  return {
    endpoint: endpoint.origin,
    region: "auto",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 1,
    followRegionRedirects: false,
    requestHandler: { connectionTimeout: 15000, requestTimeout: 600000 },
  };
}
type Sender = Pick<S3Client, "send">;
export function publicAccessReview(
  observed: string,
  operatorAttested: boolean,
) {
  requireCheck(
    ["not-verified", "managed-and-custom-disabled"].includes(observed),
    "R2_SECURITY_STATUS_INVALID",
  );
  requireCheck(
    observed === "managed-and-custom-disabled" || operatorAttested,
    "R2_SECURITY_REVIEW_REQUIRED",
  );
  return observed === "managed-and-custom-disabled"
    ? observed
    : "operator-attested-disabled";
}
export class R2Storage {
  constructor(
    readonly client: Sender,
    readonly bucket = "pusula-backups-development",
  ) {}
  async headBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (e) {
      throw new BackupError(
        status(e) === 403
          ? "R2_ACCESS_DENIED"
          : status(e) === 404
            ? "R2_BUCKET_NOT_FOUND"
            : "R2_CONNECTION_FAILED",
      );
    }
  }
  async head(key: string) {
    try {
      return await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      if (status(e) === 404) return null;
      throw new BackupError("R2_HEAD_FAILED");
    }
  }
  async getFile(key: string, path: string, limit = MAX_BYTES) {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    requireCheck(
      r.Body instanceof Readable && Number(r.ContentLength) <= limit,
      "R2_DOWNLOAD_INVALID",
    );
    let size = 0;
    await pipeline(
      r.Body,
      new Transform({
        transform(chunk, _, cb) {
          size += chunk.length;
          cb(size > limit ? new BackupError("R2_DOWNLOAD_LIMIT") : null, chunk);
        },
      }),
      createWriteStream(path, { flags: "wx", mode: 0o600 }),
    );
  }
  async downloadVerify(m: Manifest, dir: string, key: Buffer, keyId: string) {
    const head = await this.head(m.objectKey);
    requireCheck(
      head &&
        head.ContentLength === m.ciphertextSize &&
        head.Metadata?.sha256 === m.ciphertextSha256 &&
        head.Metadata?.["backup-id"] === m.backupId,
      "R2_METADATA_MISMATCH",
    );
    const path = `${dir}/remote.gcm`;
    await this.getFile(m.objectKey, path, m.ciphertextSize);
    await verifyFile(path, m, key, keyId);
  }
  async upload(
    archive: string,
    value: unknown,
    key: Buffer,
    keyId: string,
    scratch: string,
  ) {
    const m = authenticateManifest(value, key, keyId);
    requireCheck(
      m.sourceEnvironment === "development",
      "FIXTURE_UPLOAD_FORBIDDEN",
    );
    await verifyFile(archive, m, key, keyId);
    // Conditional creation is the overwrite guard; HEAD alone is insufficient.
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: m.objectKey,
          Body: createReadStream(archive),
          ContentLength: m.ciphertextSize,
          ContentType: "application/octet-stream",
          StorageClass: "STANDARD",
          IfNoneMatch: "*",
          Metadata: { sha256: m.ciphertextSha256, "backup-id": m.backupId },
        }),
      );
    } catch (e) {
      requireCheck(status(e) === 412, "R2_UPLOAD_FAILED");
    }
    await this.downloadVerify(m, scratch, key, keyId);
    // Commit manifest only after remote bytes/hash/GCM were verified.
    const manifestKey = m.objectKey.replace("archive.gcm", "manifest.json");
    const body = canonical(m);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: manifestKey,
          Body: body,
          ContentLength: Buffer.byteLength(body),
          ContentType: "application/json",
          IfNoneMatch: "*",
          StorageClass: "STANDARD",
        }),
      );
    } catch (e) {
      requireCheck(status(e) === 412, "R2_MANIFEST_UPLOAD_FAILED");
    }
    const remoteManifest = `${scratch}/remote-manifest.json`;
    await this.getFile(manifestKey, remoteManifest, 16384);
    const remote = authenticateManifest(
      await readManifest(remoteManifest),
      key,
      keyId,
    );
    requireCheck(canonical(remote) === body, "R2_MANIFEST_MISMATCH");
    return {
      backupId: m.backupId,
      status: "remote-verified",
      objectKey: m.objectKey,
    };
  }
  async list() {
    // Return candidate keys, never pretend unverified metadata is a valid backup.
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const r = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: "development/v1/",
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const o of r.Contents ?? [])
        if (
          o.Key &&
          /^development\/v1\/[a-f0-9-]{36}\/manifest\.json$/.test(o.Key)
        )
          keys.push(o.Key);
      token = r.NextContinuationToken;
      requireCheck(!r.IsTruncated || token, "R2_LIST_INCOMPLETE");
    } while (token);
    return keys;
  }
}
export function status(e: unknown) {
  return (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
}
export function createStorage(env = process.env) {
  return new R2Storage(new S3Client(r2Config(env)));
}
