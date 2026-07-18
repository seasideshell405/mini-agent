/**
 * session-manager.ts — 会话管理器
 *
 * 职责：
 *   1. 管理会话的树状结构（每条消息有 id + parentId）
 *   2. 持久化到 .jsonl 文件（JSON Lines 格式）
 *   3. 支持分支（回到历史节点开始新路径）
 *   4. 构建 AI 上下文（从 leaf 走到 root）
 *
 * 文件结构示例（一行一个 JSON）：
 *   {"type":"session","version":1,"id":"abc123","timestamp":"...","cwd":"..."}
 *   {"type":"message","id":"a1","parentId":null,"timestamp":"...","message":{...}}
 *   {"type":"message","id":"a2","parentId":"a1","timestamp":"...","message":{...}}
 *   {"type":"branch_summary","id":"b1","parentId":"a2","timestamp":"...","fromId":"a2","summary":"..."}
 *
 * 树结构示例：
 *   null (根)
 *    └─ a1 "你好"                     ← parentId: null
 *         └─ a2 "1+1=?"              ← parentId: a1
 *              ├─ a3 "结果是 2"       ← 正常继续
 *              │    └─ ...
 *              └─ [branch 到 a2]
 *                   └─ b1 (摘要)      ← 新分支的第一步
 *                        └─ b2 "不算了，写文件"
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Message,
  SessionHeader,
  SessionMessageEntry,
  BranchSummaryEntry,
  FileEntry,
  SessionEntry,
  SessionContext,
  SessionTreeNode,
} from "./types.js";

/** 生成 8 位 hex ID，用于树节点标识（碰撞概率极低） */
function generateId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * 解析 JSONL 文件内容为 FileEntry 数组
 * 逐行解析，自动跳过空行和格式错误的行
 */
function parseEntries(content: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as FileEntry;
      entries.push(entry);
    } catch {
      // 跳过损坏的行，不做处理
    }
  }
  return entries;
}

export class SessionManager {
  private sessionId: string;
  private cwd: string;
  private sessionDir: string;
  private sessionFile: string;
  /** 所有 entry 的有序列表（按 append 顺序） */
  private entries: SessionEntry[] = [];
  /** id → entry 的映射，快速查找 */
  private byId: Map<string, SessionEntry> = new Map();
  /** 当前"光标"位置，下一个 append 会成为这个节点的子节点 */
  private leafId: string | null = null;

  // ===================== 构造 / 加载 =====================

  /**
   * 创建新会话
   * 自动生成 sessionId，创建 .jsonl 文件并写入 header
   *
   * @param cwd - 当前工作目录（存入 header，便于恢复时知道上下文）
   * @param sessionDir - 会话文件存放目录
   */
  constructor(cwd: string, sessionDir: string) {
    this.cwd = cwd;
    this.sessionDir = sessionDir;
    this.sessionId = generateId() + "-" + Date.now().toString(36);

    // 确保目录存在
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // 创建会话文件，第一行写入 header
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, "-");
    this.sessionFile = path.join(sessionDir, `${fileTimestamp}_${this.sessionId}.jsonl`);

    const header: SessionHeader = {
      type: "session",
      version: 1,
      id: this.sessionId,
      timestamp,
      cwd: this.cwd,
    };

    fs.writeFileSync(this.sessionFile, JSON.stringify(header) + "\n", "utf-8");
  }

  /**
   * 从已有文件加载会话
   *
   * 读取 .jsonl 文件 → 解析 header 和 entries → 重建索引
   * 如果文件不存在或格式无效，返回 null
   *
   * @param filePath - .jsonl 文件路径
   */
  static load(filePath: string): SessionManager | null {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const fileEntries = parseEntries(content);
    if (fileEntries.length === 0) return null;

    // 第一行必须是 session header
    const header = fileEntries[0] as SessionHeader;
    if (header.type !== "session" || typeof header.id !== "string") return null;

    // 创建一个临时实例，然后替换内部状态
    const dir = path.dirname(filePath);
    const sm = new SessionManager(header.cwd || "", dir);
    sm.sessionId = header.id;
    sm.sessionFile = filePath;
    sm.entries = [];
    sm.byId = new Map();
    sm.leafId = null;

    // 跳过 header（索引 0），加载 entries
    for (const entry of fileEntries.slice(1)) {
      if (entry.type === "message" || entry.type === "branch_summary") {
        sm.entries.push(entry);
        sm.byId.set(entry.id, entry);
        sm.leafId = entry.id; // 最后一个 entry 的 id 就是 leaf
      }
    }

    return sm;
  }

  // ===================== 追加 =====================

  /**
   * 追加一条消息到会话树
   * 消息会成为当前 leaf 的子节点
   * 如果是第一条消息，parentId 为 null
   * 同时写入 .jsonl 文件
   *
   * @param message - 要存储的 Message 对象
   * @returns 新节点的 id
   */
  appendMessage(message: Message): string {
    const entry: SessionMessageEntry = {
      type: "message",
      id: generateId(),
      parentId: this.leafId, // 挂在当前 leaf 下面
      timestamp: new Date().toISOString(),
      message,
    };

    this.entries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;

    // 追加写入文件（append-only，不修改前面的内容）
    fs.appendFileSync(this.sessionFile, JSON.stringify(entry) + "\n", "utf-8");

    return entry.id;
  }

  /**
   * 追加一个分支摘要节点
   * 当用户分支到历史节点时，用这个记录"从哪分支的、放弃了什么"
   *
   * @param fromId - 从哪个 entry 分支的
   * @param summary - 对放弃路径的文本总结
   * @returns 新节点的 id
   */
  appendBranchSummary(fromId: string, summary: string): string {
    const entry: BranchSummaryEntry = {
      type: "branch_summary",
      id: generateId(),
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      fromId,
      summary,
    };

    this.entries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;

    fs.appendFileSync(this.sessionFile, JSON.stringify(entry) + "\n", "utf-8");

    return entry.id;
  }

  // ===================== 分支操作 =====================

  /**
   * 分支 — 把 leaf 移回历史某个节点
   *
   * 之后调用 appendMessage 会从该节点开始创建新分支
   * 旧路径的 entry 不会被删除，只是 leaf 不指向它们了
   *
   * 示例：
   *   a1 → a2 → a3 → a4    (当前 leaf = a4)
   *   branch("a2")          (leaf = a2)
   *   appendMessage(...)    (a5 的 parentId = a2，形成分支)
   *
   *   结果：
   *   a1 → a2 → a3 → a4    (旧路径，仍然存在)
   *         └→ a5           (新分支)
   *
   * @param entryId - 要移到的目标节点 id
   */
  branch(entryId: string): void {
    if (!this.byId.has(entryId)) {
      throw new Error(`找不到节点: ${entryId}`);
    }
    this.leafId = entryId;
  }

  /**
   * 分支并带摘要 — 比 branch() 多一步：追加一条摘要
   *
   * 使用场景：用户想回到历史节点换方向，但不想失去旧路径的上下文
   * 摘要会被 buildSessionContext 包含到 AI 上下文中
   *
   * @param entryId - 分支目标节点 id
   * @param summary - 对放弃路径的总结
   * @returns 摘要节点的 id
   */
  branchWithSummary(entryId: string, summary: string): string {
    this.branch(entryId);
    return this.appendBranchSummary(entryId, summary);
  }

  /**
   * 清空会话（重置 leaf 到 null）
   * 下次 appendMessage 会创建一个新的根节点
   * 注意：这不会删除已有 entry，只是把 leaf 指向 null
   */
  resetLeaf(): void {
    this.leafId = null;
  }

  // ===================== 查询 =====================

  /** 获取当前 leaf 的 id */
  getLeafId(): string | null {
    return this.leafId;
  }

  /** 获取当前 leaf 对应的 entry */
  getLeafEntry(): SessionEntry | undefined {
    return this.leafId ? this.byId.get(this.leafId) : undefined;
  }

  /** 根据 id 查找 entry */
  getEntry(id: string): SessionEntry | undefined {
    return this.byId.get(id);
  }

  /** 获取所有 entry（只读副本） */
  getEntries(): SessionEntry[] {
    return [...this.entries];
  }

  /** 获取会话文件路径 */
  getSessionFile(): string {
    return this.sessionFile;
  }

  /** 获取会话 ID */
  getSessionId(): string {
    return this.sessionId;
  }

  // ===================== 树遍历 =====================

  /**
   * 从指定节点（或当前 leaf）走到 root，返回路径上的所有 entry
   *
   * 通过在 byId 中不断查找 parentId 实现
   * 结果按从 root 到 leaf 的顺序排列
   *
   * @param fromId - 起始节点 id，默认当前 leaf
   */
  getBranch(fromId?: string): SessionEntry[] {
    const path: SessionEntry[] = [];
    const startId = fromId ?? this.leafId;
    let current = startId ? this.byId.get(startId) : undefined;

    // 从 leaf 往上走到 root
    while (current) {
      path.push(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }

    // 反转：root → leaf
    path.reverse();
    return path;
  }

  /**
   * 构建会话树结构（用于展示）
   *
   * 找到所有 parentId 为 null 的根节点，然后递归构建子节点
   * 注意：可能有多个根节点（比如 resetLeaf 后重新开始）
   * 孤儿节点（parentId 指向不存在的节点）也作为根节点
   */
  getTree(): SessionTreeNode[] {
    const nodeMap = new Map<string, SessionTreeNode>();
    const roots: SessionTreeNode[] = [];

    // 先创建所有节点（不含 children）
    for (const entry of this.entries) {
      nodeMap.set(entry.id, { entry, children: [] });
    }

    // 构建树：每个节点找到自己的父节点，把自己加进父节点的 children
    for (const entry of this.entries) {
      const node = nodeMap.get(entry.id)!;
      if (entry.parentId === null) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(entry.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // parentId 指向不存在的节点 → 孤儿，也当作根
          roots.push(node);
        }
      }
    }

    // 按时间排序（旧的在上，新的在下）
    function sortByTimestamp(nodes: SessionTreeNode[]): void {
      nodes.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
      for (const node of nodes) {
        sortByTimestamp(node.children);
      }
    }
    sortByTimestamp(roots);

    return roots;
  }

  // ===================== 构建 AI 上下文 =====================

  /**
   * 构建 AI 上下文 — 把树状结构转成 LLM 能理解的平铺消息列表
   *
   * 处理逻辑：
   *   1. 从当前 leaf 走到 root，得到路径
   *   2. 路径上的 message entry → 保留原始 Message
   *   3. 路径上的 branch_summary entry → 转成一段文本描述
   *
   * 这样 AI 通过分支摘要就能知道"之前尝试过其他方案，但放弃了"
   *
   * @param leafId - 从哪个 leaf 开始走，默认当前 leaf
   */
  buildSessionContext(leafId?: string): SessionContext {
    const path = this.getBranch(leafId);
    const messages: Message[] = [];

    for (const entry of path) {
      if (entry.type === "message") {
        // 直接保留原始消息
        messages.push(entry.message);
      } else if (entry.type === "branch_summary") {
        // 把分支摘要转成一段 user 消息，告诉 AI"之前试过别的"
        messages.push({
          role: "user",
          content: `[分支摘要] 从这里分支，放弃了后续路径:\n${entry.summary}`,
        });
      }
    }

    return { messages };
  }
}
