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
 *   {"type":"branch_summary","id":"b1","parentId":"a2","timestamp":"...","fromId":"a2","summary":"..."}
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger/index.js";
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

/** 生成 8 位 hex ID，用于树节点标识 */
function generateId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * 解析 JSONL 文件内容为 FileEntry 数组
 */
function parseEntries(content: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as FileEntry;
      entries.push(entry);
    } catch {
      // 跳过损坏的行
    }
  }
  return entries;
}

export class SessionManager {
  private sessionId: string;
  private cwd: string;
  private sessionDir: string;
  private sessionFile: string;
  private entries: SessionEntry[] = [];
  private byId: Map<string, SessionEntry> = new Map();
  private leafId: string | null = null;

  // ===================== 构造 / 加载 =====================

  constructor(cwd: string, sessionDir: string) {
    this.cwd = cwd;
    this.sessionDir = sessionDir;
    this.sessionId = generateId() + "-" + Date.now().toString(36);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

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

    logger.info("session", `新会话创建: ${this.sessionId}`);
    logger.debug("session", `会话文件: ${this.sessionFile}`);
  }

  static load(filePath: string): SessionManager | null {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const fileEntries = parseEntries(content);
    if (fileEntries.length === 0) return null;

    const header = fileEntries[0] as SessionHeader;
    if (header.type !== "session" || typeof header.id !== "string") return null;

    // 用 Object.create 绕过构造函数（避免写新文件），直接构建实例
    const dir = path.dirname(filePath);
    const sm = Object.create(SessionManager.prototype) as SessionManager;
    sm.cwd = header.cwd || "";
    sm.sessionDir = dir;
    sm.sessionId = header.id;
    sm.sessionFile = filePath;
    sm.entries = [];
    sm.byId = new Map();
    sm.leafId = null;

    for (const entry of fileEntries.slice(1)) {
      if (entry.type === "message" || entry.type === "branch_summary") {
        sm.entries.push(entry);
        sm.byId.set(entry.id, entry);
        sm.leafId = entry.id;
      }
    }

    logger.info("session", `会话已加载: ${sm.sessionId}（${sm.entries.length} 条记录）`);
    return sm;
  }

  // ===================== 追加 =====================

  appendMessage(message: Message): string {
    const entry: SessionMessageEntry = {
      type: "message",
      id: generateId(),
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      message,
    };

    this.entries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;

    fs.appendFileSync(this.sessionFile, JSON.stringify(entry) + "\n", "utf-8");

    // 日志里只记角色摘要，不记完整内容（内容可能很长）
    const rolePreview = message.role;
    const contentPreview = message.content
      ? message.content.slice(0, 60) + (message.content.length > 60 ? "..." : "")
      : "(null)";
    logger.debug("session", `追加消息 [${entry.id}]: role=${rolePreview}, content="${contentPreview}"`);

    return entry.id;
  }

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
   * 限制：不能 branch 到有 tool_calls 的 assistant 消息。
   * 因为 OpenAI 兼容 API 要求 tool_calls 后面必须跟 tool 结果，
   * 如果从这个节点开始新分支，后面接 user 消息会导致 API 报错。
   */
  branch(entryId: string): void {
    if (!this.byId.has(entryId)) {
      const err = `找不到节点: ${entryId}`;
      logger.error("session", `分支失败: ${err}`);
      throw new Error(err);
    }

    const entry = this.byId.get(entryId)!;

    // 不允许 branch 到有 tool_calls 的 assistant 消息
    if (entry.type === "message" && entry.message.role === "assistant" && entry.message.tool_calls) {
      const err = `不能分支到有工具调用的 AI 消息，请分支到它的父节点 ${entry.parentId || "（根节点）"}`;
      logger.warn("session", `分支被拒绝: ${err}`);
      throw new Error(err);
    }

    this.leafId = entryId;
    logger.info("session", `分支到节点 ${entryId}`);
  }

  /**
   * 分支并带摘要 — 比 branch() 多一步：追加一条摘要
   */
  branchWithSummary(entryId: string, summary: string): string {
    this.branch(entryId);
    logger.info("session", `分支并生成摘要，放弃的路径已被总结`);
    return this.appendBranchSummary(entryId, summary);
  }

  resetLeaf(): void {
    this.leafId = null;
  }

  // ===================== 查询 =====================

  getLeafId(): string | null {
    return this.leafId;
  }

  getLeafEntry(): SessionEntry | undefined {
    return this.leafId ? this.byId.get(this.leafId) : undefined;
  }

  getEntry(id: string): SessionEntry | undefined {
    return this.byId.get(id);
  }

  getEntries(): SessionEntry[] {
    return [...this.entries];
  }

  getSessionFile(): string {
    return this.sessionFile;
  }

  // ===================== 清理 =====================

  /**
   * 判断会话是否为空（没有任何消息记录，只有 header）
   *
   * 用于退出时判断：如果用户啥都没说，就不留会话文件
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * 删除会话文件
   *
   * 注意：这只是清理磁盘上的文件，不影响内存中的对象
   */
  deleteSessionFile(): void {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
        logger.info("session", `空会话文件已删除: ${this.sessionId}`);
      }
    } catch (err) {
      logger.error("session", `删除会话文件失败: ${err}`);
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ===================== 树遍历 =====================

  /**
   * 从指定节点（或当前 leaf）走到 root
   * 结果按 root → leaf 顺序排列
   */
  getBranch(fromId?: string): SessionEntry[] {
    const path: SessionEntry[] = [];
    const startId = fromId ?? this.leafId;
    let current = startId ? this.byId.get(startId) : undefined;

    while (current) {
      path.push(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }

    path.reverse();
    return path;
  }

  /**
   * 获取从 target 到当前 leaf 之间"被放弃"的 entry（不含 target 本身）
   *
   * 用于分支时生成摘要。如果 target 不在当前 leaf 路径上，
   * 返回空数组（无法简单判断哪些 entry 被放弃）。
   */
  getAbandonedEntries(targetId: string): SessionEntry[] {
    if (!this.byId.has(targetId)) {
      throw new Error(`找不到节点: ${targetId}`);
    }

    const leafPath = this.getBranch();
    const targetIndex = leafPath.findIndex(e => e.id === targetId);

    if (targetIndex === -1) {
      // target 不在当前路径上（在别的分支），无法简单判断
      return [];
    }

    // target 之后到 leaf 之间的 entry 就是被放弃的
    return leafPath.slice(targetIndex + 1);
  }

  /**
   * 构建会话树结构（用于展示）
   */
  getTree(): SessionTreeNode[] {
    const nodeMap = new Map<string, SessionTreeNode>();
    const roots: SessionTreeNode[] = [];

    for (const entry of this.entries) {
      nodeMap.set(entry.id, { entry, children: [] });
    }

    for (const entry of this.entries) {
      const node = nodeMap.get(entry.id)!;
      if (entry.parentId === null) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(entry.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    }

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
   */
  buildSessionContext(leafId?: string): SessionContext {
    const path = this.getBranch(leafId);
    const messages: Message[] = [];

    for (const entry of path) {
      if (entry.type === "message") {
        messages.push(entry.message);
      } else if (entry.type === "branch_summary") {
        messages.push({
          role: "user",
          content: `[分支摘要] 从这里分支，放弃了后续路径:\n${entry.summary}`,
        });
      }
    }

    logger.debug("session", `构建上下文完成: ${path.length} 个节点 → ${messages.length} 条消息`);
    return { messages };
  }
}
