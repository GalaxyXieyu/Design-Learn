"use strict";

const major = Number(process.versions.node.split(".")[0]);
const isSupported = major >= 18 && major < 23;

if (!isSupported) {
  console.error("=== Node 版本不支持 ===");
  console.error(
    `[design-learn] 仅支持 Node 18/20，当前版本 ${process.versions.node}。`
  );
  console.error("[design-learn] 请切换到 Node 18/20 后重试。");
  process.exit(1);
}

