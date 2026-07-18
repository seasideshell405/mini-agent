/**
 * types.ts — 所有类型定义
 *
 * 把类型集中在一个文件里，其他地方 import 引用
 * 这样改类型时只需要改一处
 */

/** AI 的消息结构 —— 对话历史的基本单位 */
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  /** assistant 消息可能带工具调用指令 */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** tool 消息关联到哪个工具调用 */
  tool_call_id?: string;
  name?: string;
};

/** 工具定义 —— 给 AI 看的说明书 */
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

/** 工具实现 —— 给程序用的函数签名 */
export type ToolImplementation = (args: Record<string, any>) => string;

// ===================== Session 管理类型 =====================

/**
 * 会话文件头 — JSONL 文件的第一行
 * 记录会话的元信息：ID、创建时间、工作目录
 */
export type SessionHeader = {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
  /** 从其他会话 fork 时，记录来源路径 */
  parentSession?: string;
};

/**
 * 会话树节点的基础字段
 * 每个节点有唯一 id，parentId 指向父节点（构成树）
 */
export type SessionEntryBase = {
  id: string;
  /** null 表示根节点 */
  parentId: string | null;
  timestamp: string;
};

/**
 * 消息节点 — 树中的一条对话消息
 * 存的是原始 Message 对象，用户/AI/工具消息都走这个
 */
export type SessionMessageEntry = SessionEntryBase & {
  type: "message";
  message: Message;
};

/**
 * 分支摘要节点 — 记录从哪分支、放弃了什么
 * 当用户 branch 到历史节点时，插入一条摘要
 * buildSessionContext 会把它转成 LLM 能理解的文本
 */
export type BranchSummaryEntry = SessionEntryBase & {
  type: "branch_summary";
  /** 从哪个节点开始分支的 */
  fromId: string;
  /** 对放弃路径的总结 */
  summary: string;
};

/** 文件中任意一行的类型（header + 所有 entry 类型） */
export type FileEntry = SessionHeader | SessionMessageEntry | BranchSummaryEntry;

/** 会话树的所有节点类型（不含 header） */
export type SessionEntry = SessionMessageEntry | BranchSummaryEntry;

/**
 * 会话树节点（用于展示树结构）
 * entry: 当前节点
 * children: 子节点列表
 */
export type SessionTreeNode = {
  entry: SessionEntry;
  children: SessionTreeNode[];
};

/** buildSessionContext 的返回结果 */
export type SessionContext = {
  messages: Message[];
};
