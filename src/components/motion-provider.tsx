'use client';
import {MotionConfig} from 'motion/react';
export function MotionProvider({children}:{children:React.ReactNode}){return <MotionConfig reducedMotion="user" transition={{duration:.2,ease:[.22,1,.36,1]}}>{children}</MotionConfig>;}
