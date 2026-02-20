import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex } from "viem";
import {
  ERC8004_CHAINS,
  deriveAddress,
  type Erc8004Chain,
} from "./erc8004.js";

// We test the chain registry data and the pure deriveAddress function.
// The on-chain functions (registerAgent, setAgentURI) depend on real RPC
// calls and are tested at the integration/command level with mocks.

describe("ERC8004_CHAINS", () => {
  it("should contain at least 20 chains", () => {
    expect(ERC8004_CHAINS.length).toBeGreaterThanOrEqual(20);
  });

  it("should have unique chain IDs", () => {
    const ids = ERC8004_CHAINS.map((c) => c.chainId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have both testnets and mainnets", () => {
    const testnets = ERC8004_CHAINS.filter((c) => c.testnet);
    const mainnets = ERC8004_CHAINS.filter((c) => !c.testnet);
    expect(testnets.length).toBeGreaterThan(0);
    expect(mainnets.length).toBeGreaterThan(0);
  });

  it("should use the testnet registry address for all testnets", () => {
    const testnets = ERC8004_CHAINS.filter((c) => c.testnet);
    for (const chain of testnets) {
      expect(chain.registry).toBe(
        "0x8004A818BFB912233c491871b3d84c89A494BD9e",
      );
    }
  });

  it("should use the mainnet registry address for all mainnets", () => {
    const mainnets = ERC8004_CHAINS.filter((c) => !c.testnet);
    for (const chain of mainnets) {
      expect(chain.registry).toBe(
        "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      );
    }
  });

  it("should have non-empty name, rpcUrl, and explorerTxUrl for every chain", () => {
    for (const chain of ERC8004_CHAINS) {
      expect(chain.name).toBeTruthy();
      expect(chain.rpcUrl).toMatch(/^https?:\/\//);
      expect(chain.explorerTxUrl).toMatch(/^https?:\/\//);
    }
  });

  it("should include Base Sepolia as a testnet", () => {
    const baseSepolia = ERC8004_CHAINS.find((c) => c.chainId === 84532);
    expect(baseSepolia).toBeDefined();
    expect(baseSepolia!.testnet).toBe(true);
    expect(baseSepolia!.name).toBe("Base Sepolia");
  });

  it("should include Ethereum Mainnet", () => {
    const eth = ERC8004_CHAINS.find((c) => c.chainId === 1);
    expect(eth).toBeDefined();
    expect(eth!.testnet).toBe(false);
    expect(eth!.name).toBe("Ethereum");
  });

  it("should have explorer URLs ending with /tx/ or /tx", () => {
    for (const chain of ERC8004_CHAINS) {
      expect(chain.explorerTxUrl).toMatch(/\/tx\/$/);
    }
  });
});

describe("deriveAddress", () => {
  it("should derive a valid Ethereum address from a private key", () => {
    // Well-known test private key (Hardhat account #0)
    const testKey: Hex =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const address = deriveAddress(testKey);
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address.toLowerCase()).toBe(
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    );
  });

  it("should throw for an invalid private key", () => {
    expect(() => deriveAddress("0xinvalid" as Hex)).toThrow();
  });
});
