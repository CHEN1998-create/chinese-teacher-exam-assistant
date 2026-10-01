"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 由 /exam 根据目标状态决定：首次进入引导澄清，否则展示当前目标
    router.replace("/exam");
  }, [router]);

  return null;
}
