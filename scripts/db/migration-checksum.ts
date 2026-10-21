// Explicit byte identities, not newline normalization. Only these five reviewed
// Git LF blobs and historical final-CRLF artifacts are interchangeable for
// comparison. No file bytes or PostgreSQL history values are rewritten.
// Provenance: preexisting development READ ONLY history captured on 2026-10-20,
// independently compared with HEAD LF blobs and the unchanged baseline in 9a.
const historicalPairs: Record<string, readonly [string, string]> = {
  "202610160004_auth_mfa": [
    "96a7e660105b3ff8f897e0894d6eb8ceea3ee7152a4747c04cd1cbf449020644",
    "eced9930cf54c6253430f3a5b3a77d4e98906ee6978b620769be8af181359abb",
  ],
  "202610160005_authorization": [
    "27bfae7c1ba1622774e57d4fe226893f46089b5c68bef3e8779fe2c7c7ed899a",
    "813bb385499c1f39c7a808ca030ac8f9585ddbb4db32bbfa0d7b6f6858b04a98",
  ],
  "202610160007_resource_policy": [
    "b0154ad979dd5a3ba077dbfa65379fee95eb420283b59166c2c52ca0a986bd86",
    "014cf289639104b7549448d0a0c752feb153c7be07cc707eaa9cfe55a48cba6d",
  ],
  "202610160008_company_metadata": [
    "db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a",
    "5aa71bc7fd52a4d06b053623205dbe9f5530959bd46682dd7030722c1f2955ec",
  ],
  "202610170012_cloud_catalog_controls": [
    "ee460b6466adbae8755b64840af36de3eb4d52756947ce6e6153fb2a791e2e2e",
    "5179a9075660b49861b9176fc5713e28c6ee59109f083473525a1209a77ced39",
  ],
};

export const reviewedRollback008 =
  "35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9";

export function migrationChecksumMatches(
  name: string,
  expected: string,
  actual: string,
) {
  if (expected === actual) return true;
  const pair = Object.hasOwn(historicalPairs, name)
    ? historicalPairs[name]
    : undefined;
  return !!pair && pair.includes(expected) && pair.includes(actual);
}

// Historical failed bytes are never accepted as executable SQL or as success.
export function reviewedRollbackMatches(name: string, checksum: string) {
  return (
    name === "202610160008_company_metadata" && checksum === reviewedRollback008
  );
}
