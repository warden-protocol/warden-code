import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  isDirectoryEmpty,
  directoryExists,
  fileExists,
  createDirectory,
  writeFile,
  readFile,
  copyDirectory,
} from "./project.js";

describe("project utilities", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "warden-test-"));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("isDirectoryEmpty", () => {
    it("should return true for empty directory", async () => {
      const emptyDir = path.join(testDir, "empty");
      await fs.mkdir(emptyDir);

      expect(await isDirectoryEmpty(emptyDir)).toBe(true);
    });

    it("should return false for directory with files", async () => {
      const dirWithFiles = path.join(testDir, "with-files");
      await fs.mkdir(dirWithFiles);
      await fs.writeFile(path.join(dirWithFiles, "test.txt"), "content");

      expect(await isDirectoryEmpty(dirWithFiles)).toBe(false);
    });

    it("should return true for directory with only hidden files", async () => {
      const dirWithHidden = path.join(testDir, "with-hidden");
      await fs.mkdir(dirWithHidden);
      await fs.writeFile(path.join(dirWithHidden, ".hidden"), "content");
      await fs.writeFile(path.join(dirWithHidden, ".git"), "content");

      expect(await isDirectoryEmpty(dirWithHidden)).toBe(true);
    });

    it("should return false for directory with hidden and visible files", async () => {
      const mixedDir = path.join(testDir, "mixed");
      await fs.mkdir(mixedDir);
      await fs.writeFile(path.join(mixedDir, ".hidden"), "content");
      await fs.writeFile(path.join(mixedDir, "visible.txt"), "content");

      expect(await isDirectoryEmpty(mixedDir)).toBe(false);
    });

    it("should return true for non-existent directory", async () => {
      const nonExistent = path.join(testDir, "does-not-exist");

      expect(await isDirectoryEmpty(nonExistent)).toBe(true);
    });
  });

  describe("directoryExists", () => {
    it("should return true for existing directory", async () => {
      const dir = path.join(testDir, "existing-dir");
      await fs.mkdir(dir);

      expect(await directoryExists(dir)).toBe(true);
    });

    it("should return false for non-existent path", async () => {
      const nonExistent = path.join(testDir, "non-existent");

      expect(await directoryExists(nonExistent)).toBe(false);
    });

    it("should return false for file path", async () => {
      const filePath = path.join(testDir, "file.txt");
      await fs.writeFile(filePath, "content");

      expect(await directoryExists(filePath)).toBe(false);
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const filePath = path.join(testDir, "existing.txt");
      await fs.writeFile(filePath, "content");

      expect(await fileExists(filePath)).toBe(true);
    });

    it("should return false for non-existent path", async () => {
      const nonExistent = path.join(testDir, "non-existent.txt");

      expect(await fileExists(nonExistent)).toBe(false);
    });

    it("should return false for directory path", async () => {
      const dirPath = path.join(testDir, "directory");
      await fs.mkdir(dirPath);

      expect(await fileExists(dirPath)).toBe(false);
    });
  });

  describe("createDirectory", () => {
    it("should create a directory", async () => {
      const newDir = path.join(testDir, "new-dir");

      await createDirectory(newDir);

      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("should create nested directories", async () => {
      const nestedDir = path.join(testDir, "a", "b", "c");

      await createDirectory(nestedDir);

      const stat = await fs.stat(nestedDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      const existingDir = path.join(testDir, "existing");
      await fs.mkdir(existingDir);

      await expect(createDirectory(existingDir)).resolves.not.toThrow();
    });
  });

  describe("writeFile", () => {
    it("should write content to a file", async () => {
      const filePath = path.join(testDir, "test.txt");

      await writeFile(filePath, "Hello, World!");

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("Hello, World!");
    });

    it("should create parent directories if they do not exist", async () => {
      const filePath = path.join(testDir, "nested", "dir", "file.txt");

      await writeFile(filePath, "content");

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("content");
    });

    it("should overwrite existing file", async () => {
      const filePath = path.join(testDir, "overwrite.txt");
      await fs.writeFile(filePath, "old content");

      await writeFile(filePath, "new content");

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("new content");
    });
  });

  describe("readFile", () => {
    it("should read file content", async () => {
      const filePath = path.join(testDir, "read-test.txt");
      await fs.writeFile(filePath, "test content");

      const content = await readFile(filePath);

      expect(content).toBe("test content");
    });

    it("should throw for non-existent file", async () => {
      const nonExistent = path.join(testDir, "non-existent.txt");

      await expect(readFile(nonExistent)).rejects.toThrow();
    });
  });

  describe("copyDirectory", () => {
    it("should copy files from source to destination", async () => {
      const src = path.join(testDir, "src");
      const dest = path.join(testDir, "dest");
      await fs.mkdir(src);
      await fs.writeFile(path.join(src, "file1.txt"), "content1");
      await fs.writeFile(path.join(src, "file2.txt"), "content2");

      await copyDirectory(src, dest);

      expect(await fs.readFile(path.join(dest, "file1.txt"), "utf-8")).toBe(
        "content1"
      );
      expect(await fs.readFile(path.join(dest, "file2.txt"), "utf-8")).toBe(
        "content2"
      );
    });

    it("should copy nested directories", async () => {
      const src = path.join(testDir, "src-nested");
      const dest = path.join(testDir, "dest-nested");
      await fs.mkdir(path.join(src, "subdir"), { recursive: true });
      await fs.writeFile(path.join(src, "root.txt"), "root");
      await fs.writeFile(path.join(src, "subdir", "nested.txt"), "nested");

      await copyDirectory(src, dest);

      expect(await fs.readFile(path.join(dest, "root.txt"), "utf-8")).toBe(
        "root"
      );
      expect(
        await fs.readFile(path.join(dest, "subdir", "nested.txt"), "utf-8")
      ).toBe("nested");
    });

    it("should create destination directory if it does not exist", async () => {
      const src = path.join(testDir, "src-create");
      const dest = path.join(testDir, "dest-create");
      await fs.mkdir(src);
      await fs.writeFile(path.join(src, "file.txt"), "content");

      await copyDirectory(src, dest);

      const stat = await fs.stat(dest);
      expect(stat.isDirectory()).toBe(true);
    });
  });
});
