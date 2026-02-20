export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "file_start"; filePath: string }
  | { type: "file_end"; filePath: string; content: string };

type ParserState = "text" | "fence_maybe" | "code" | "close_maybe";

/**
 * Incremental streaming parser that detects annotated code block fences
 * (```language:path) as tokens arrive, routing explanation text to the
 * terminal and silently buffering file contents.
 *
 * Generic code blocks (no :path annotation) pass through as text.
 */
export class StreamParser {
  private state: ParserState = "text";
  private fenceBuffer = "";
  private codeBuffer = "";
  private currentFilePath = "";
  private fullResponse = "";
  private atLineStart = true;

  /** Process a token delta. Returns events to handle. */
  feed(delta: string): StreamEvent[] {
    this.fullResponse += delta;
    const events: StreamEvent[] = [];

    for (const ch of delta) {
      switch (this.state) {
        case "text":
          this.handleText(ch, events);
          break;
        case "fence_maybe":
          this.handleFenceMaybe(ch, events);
          break;
        case "code":
          this.handleCode(ch, events);
          break;
        case "close_maybe":
          this.handleCloseMaybe(ch, events);
          break;
      }
    }

    return this.coalesceTextEvents(events);
  }

  /** Signal end of stream. Flushes remaining buffered state. */
  flush(): StreamEvent[] {
    const events: StreamEvent[] = [];

    switch (this.state) {
      case "fence_maybe":
        // Incomplete fence opening; emit as text
        if (this.fenceBuffer) {
          events.push({ type: "text", content: this.fenceBuffer });
          this.fenceBuffer = "";
        }
        break;
      case "close_maybe":
        // The closing fence buffer is exactly "```" at end of stream.
        // This counts as a valid close.
        if (this.fenceBuffer === "```") {
          events.push({
            type: "file_end",
            filePath: this.currentFilePath,
            content: this.codeBuffer,
          });
          this.codeBuffer = "";
          this.currentFilePath = "";
        } else {
          // Incomplete close; append to code and emit as truncated file
          this.codeBuffer += this.fenceBuffer;
          events.push({
            type: "file_end",
            filePath: this.currentFilePath,
            content: this.codeBuffer,
          });
          this.codeBuffer = "";
          this.currentFilePath = "";
        }
        break;
      case "code":
        // Stream ended mid-code-block; emit what we have
        events.push({
          type: "file_end",
          filePath: this.currentFilePath,
          content: this.codeBuffer,
        });
        this.codeBuffer = "";
        this.currentFilePath = "";
        break;
    }

    this.state = "text";
    this.fenceBuffer = "";
    this.atLineStart = true;
    return events;
  }

  /** Returns the complete accumulated response (for conversation history). */
  getFullResponse(): string {
    return this.fullResponse;
  }

  private handleText(ch: string, events: StreamEvent[]): void {
    if (ch === "`") {
      this.state = "fence_maybe";
      this.fenceBuffer = "`";
    } else {
      events.push({ type: "text", content: ch });
    }
  }

  private handleFenceMaybe(ch: string, events: StreamEvent[]): void {
    this.fenceBuffer += ch;

    // Still accumulating backticks
    if (this.fenceBuffer.length <= 3 && ch === "`") {
      return;
    }

    // Less than 3 backticks followed by non-backtick: not a fence
    if (countLeadingBackticks(this.fenceBuffer) < 3) {
      events.push({ type: "text", content: this.fenceBuffer });
      this.fenceBuffer = "";
      this.state = "text";
      return;
    }

    // We have 3+ backticks. Now accumulate until we see a newline or
    // determine this can't be an annotated fence.

    if (ch === "\n") {
      // Fence line complete. Check if it matches ```lang:path
      const fenceLine = this.fenceBuffer.slice(0, -1); // strip the \n
      const match = fenceLine.match(/^```\w+:(.+)$/);
      if (match) {
        // Annotated code block: suppress content, emit file_start
        this.currentFilePath = match[1]!.trim();
        this.codeBuffer = "";
        this.atLineStart = true;
        this.fenceBuffer = "";
        this.state = "code";
        events.push({ type: "file_start", filePath: this.currentFilePath });
      } else {
        // Generic code block or just backticks + newline: emit as text
        events.push({ type: "text", content: this.fenceBuffer });
        this.fenceBuffer = "";
        this.state = "text";
      }
      return;
    }

    // Safety: if the fence buffer gets unreasonably long without a newline,
    // it's not a fence we care about
    if (this.fenceBuffer.length > 200) {
      events.push({ type: "text", content: this.fenceBuffer });
      this.fenceBuffer = "";
      this.state = "text";
    }
  }

  private handleCode(ch: string, events: StreamEvent[]): void {
    if (ch === "`" && this.atLineStart) {
      this.state = "close_maybe";
      this.fenceBuffer = "`";
    } else {
      this.codeBuffer += ch;
      this.atLineStart = ch === "\n";
    }
  }

  private handleCloseMaybe(ch: string, events: StreamEvent[]): void {
    if (ch === "`" && this.fenceBuffer.length < 3) {
      this.fenceBuffer += "`";
      return;
    }

    if (this.fenceBuffer === "```" && (ch === "\n" || ch === "\r")) {
      // Valid closing fence
      events.push({
        type: "file_end",
        filePath: this.currentFilePath,
        content: this.codeBuffer,
      });
      this.codeBuffer = "";
      this.currentFilePath = "";
      this.fenceBuffer = "";
      this.state = "text";
      this.atLineStart = true;
      return;
    }

    // Not a closing fence; put everything back into the code buffer
    this.codeBuffer += this.fenceBuffer;
    this.fenceBuffer = "";
    this.state = "code";

    // Re-process the current character in code state
    if (ch === "`" && this.atLineStart) {
      this.state = "close_maybe";
      this.fenceBuffer = "`";
    } else {
      this.codeBuffer += ch;
      this.atLineStart = ch === "\n";
    }
  }

  /** Merge adjacent text events into a single event for efficiency. */
  private coalesceTextEvents(events: StreamEvent[]): StreamEvent[] {
    if (events.length <= 1) return events;

    const result: StreamEvent[] = [];
    let pendingText = "";

    for (const event of events) {
      if (event.type === "text") {
        pendingText += event.content;
      } else {
        if (pendingText) {
          result.push({ type: "text", content: pendingText });
          pendingText = "";
        }
        result.push(event);
      }
    }

    if (pendingText) {
      result.push({ type: "text", content: pendingText });
    }

    return result;
  }
}

function countLeadingBackticks(s: string): number {
  let count = 0;
  for (const ch of s) {
    if (ch === "`") count++;
    else break;
  }
  return count;
}
