# issues CSV 快照

## 目的

- 将当前 issues CSV 复制为带时间戳的快照文件，便于回溯。

## 使用方法

```bash
node scripts/snapshot-issues.js --source issues/<current.csv>
```

可选参数：

- `--out-dir`：输出目录，默认 `issues`。

## 注意事项

- 快照以原始 CSV 为来源，仅做只读备份。
- 该脚本不会修改源 CSV。
