import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Types ──────────────────────────────────────────────────────

export interface Erc8004Chain {
  name: string;
  chainId: number;
  registry: Hex;
  rpcUrl: string;
  explorerTxUrl: string;
  testnet: boolean;
}

export interface RegisterResult {
  agentId: bigint;
  txHash: Hex;
}

export interface SetUriResult {
  txHash: Hex;
}

// ── Contract constants ─────────────────────────────────────────

const MAINNET_REGISTRY: Hex = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const TESTNET_REGISTRY: Hex = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

/**
 * Minimal ABI for the ERC-8004 IdentityRegistry.
 * Only includes the two functions and one event needed for registration.
 */
const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

// ── Chain registry ─────────────────────────────────────────────

export const ERC8004_CHAINS: Erc8004Chain[] = [
  // Testnets
  {
    name: "Base Sepolia",
    chainId: 84532,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://sepolia.base.org",
    explorerTxUrl: "https://sepolia.basescan.org/tx/",
    testnet: true,
  },
  {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://sepolia.drpc.org",
    explorerTxUrl: "https://sepolia.etherscan.io/tx/",
    testnet: true,
  },
  {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerTxUrl: "https://sepolia.arbiscan.io/tx/",
    testnet: true,
  },
  {
    name: "Optimism Sepolia",
    chainId: 11155420,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://sepolia.optimism.io",
    explorerTxUrl: "https://sepolia-optimism.etherscan.io/tx/",
    testnet: true,
  },
  {
    name: "Polygon Amoy",
    chainId: 80002,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    explorerTxUrl: "https://amoy.polygonscan.com/tx/",
    testnet: true,
  },
  {
    name: "Abstract Testnet",
    chainId: 11124,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://api.testnet.abs.xyz",
    explorerTxUrl: "https://explorer.testnet.abs.xyz/tx/",
    testnet: true,
  },
  {
    name: "Avalanche Fuji",
    chainId: 43113,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorerTxUrl: "https://testnet.snowtrace.io/tx/",
    testnet: true,
  },
  {
    name: "Celo Alfajores",
    chainId: 44787,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://alfajores-forno.celo-testnet.org",
    explorerTxUrl: "https://sepolia.celoscan.io/tx/",
    testnet: true,
  },
  {
    name: "Linea Sepolia",
    chainId: 59141,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://rpc.sepolia.linea.build",
    explorerTxUrl: "https://sepolia.lineascan.build/tx/",
    testnet: true,
  },
  {
    name: "Mantle Sepolia",
    chainId: 5003,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://rpc.sepolia.mantle.xyz",
    explorerTxUrl: "https://sepolia.mantlescan.xyz/tx/",
    testnet: true,
  },
  {
    name: "MegaETH Testnet",
    chainId: 6342001,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://carrot.megaeth.com/rpc",
    explorerTxUrl: "https://megaeth-testnet-v2.blockscout.com/tx/",
    testnet: true,
  },
  {
    name: "Scroll Sepolia",
    chainId: 534351,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://sepolia-rpc.scroll.io",
    explorerTxUrl: "https://sepolia.scrollscan.com/tx/",
    testnet: true,
  },
  {
    name: "Monad Testnet",
    chainId: 10143,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://testnet-rpc.monad.xyz",
    explorerTxUrl: "https://monad-testnet.socialscan.io/tx/",
    testnet: true,
  },
  {
    name: "BSC Testnet",
    chainId: 97,
    registry: TESTNET_REGISTRY,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerTxUrl: "https://testnet.bscscan.com/tx/",
    testnet: true,
  },

  // Mainnets
  {
    name: "Base",
    chainId: 8453,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://mainnet.base.org",
    explorerTxUrl: "https://basescan.org/tx/",
    testnet: false,
  },
  {
    name: "Ethereum",
    chainId: 1,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://eth.drpc.org",
    explorerTxUrl: "https://etherscan.io/tx/",
    testnet: false,
  },
  {
    name: "Arbitrum",
    chainId: 42161,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerTxUrl: "https://arbiscan.io/tx/",
    testnet: false,
  },
  {
    name: "Optimism",
    chainId: 10,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://mainnet.optimism.io",
    explorerTxUrl: "https://optimistic.etherscan.io/tx/",
    testnet: false,
  },
  {
    name: "Polygon",
    chainId: 137,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://polygon-rpc.com",
    explorerTxUrl: "https://polygonscan.com/tx/",
    testnet: false,
  },
  {
    name: "Abstract",
    chainId: 2741,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://api.mainnet.abs.xyz",
    explorerTxUrl: "https://explorer.mainnet.abs.xyz/tx/",
    testnet: false,
  },
  {
    name: "Avalanche",
    chainId: 43114,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerTxUrl: "https://snowtrace.io/tx/",
    testnet: false,
  },
  {
    name: "Celo",
    chainId: 42220,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://forno.celo.org",
    explorerTxUrl: "https://celoscan.io/tx/",
    testnet: false,
  },
  {
    name: "Gnosis",
    chainId: 100,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.gnosischain.com",
    explorerTxUrl: "https://gnosisscan.io/tx/",
    testnet: false,
  },
  {
    name: "Linea",
    chainId: 59144,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.linea.build",
    explorerTxUrl: "https://lineascan.build/tx/",
    testnet: false,
  },
  {
    name: "Mantle",
    chainId: 5000,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.mantle.xyz",
    explorerTxUrl: "https://mantle.socialscan.io/tx/",
    testnet: false,
  },
  {
    name: "MegaETH",
    chainId: 6342,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.megaeth.com",
    explorerTxUrl: "https://mega.etherscan.io/tx/",
    testnet: false,
  },
  {
    name: "Scroll",
    chainId: 534352,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.scroll.io",
    explorerTxUrl: "https://scrollscan.com/tx/",
    testnet: false,
  },
  {
    name: "Taiko",
    chainId: 167000,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.mainnet.taiko.xyz",
    explorerTxUrl: "https://taikoscan.io/tx/",
    testnet: false,
  },
  {
    name: "Monad",
    chainId: 143,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://rpc.monad.xyz/monad",
    explorerTxUrl: "https://monadscan.com/tx/",
    testnet: false,
  },
  {
    name: "BSC",
    chainId: 56,
    registry: MAINNET_REGISTRY,
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorerTxUrl: "https://bscscan.com/tx/",
    testnet: false,
  },
];

// ── Helpers ────────────────────────────────────────────────────

export function deriveAddress(privateKey: Hex): Hex {
  return privateKeyToAccount(privateKey).address;
}

function makeClients(privateKey: Hex, chain: Erc8004Chain) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(chain.rpcUrl);
  const chainDef = {
    id: chain.chainId,
    name: chain.name,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [chain.rpcUrl] } },
  } as const;

  const publicClient = createPublicClient({ chain: chainDef, transport });
  const walletClient = createWalletClient({
    account,
    chain: chainDef,
    transport,
  });

  return { publicClient, walletClient, account };
}

// ── On-chain operations ────────────────────────────────────────

export async function registerAgent(
  privateKey: Hex,
  chain: Erc8004Chain,
): Promise<RegisterResult> {
  const { publicClient, walletClient } = makeClients(privateKey, chain);

  const txHash = await walletClient.writeContract({
    address: chain.registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  const logs = parseEventLogs({
    abi: IDENTITY_REGISTRY_ABI,
    eventName: "Registered",
    logs: receipt.logs,
  });

  if (logs.length === 0) {
    throw new Error(
      "Transaction succeeded but no Registered event was found in the receipt.",
    );
  }

  return { agentId: logs[0].args.agentId, txHash };
}

export async function setAgentURI(
  privateKey: Hex,
  chain: Erc8004Chain,
  agentId: bigint,
  agentURI: string,
): Promise<SetUriResult> {
  const { publicClient, walletClient } = makeClients(privateKey, chain);

  const txHash = await walletClient.writeContract({
    address: chain.registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "setAgentURI",
    args: [agentId, agentURI],
  });

  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  return { txHash };
}
