import { ENIGMA_DECIMALS } from "../constants/privacy/constants";


export const formatHex = (value: bigint): string => {
  return "0x" + value.toString(16);
};

export const shortenString = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatTokenAmount = (value: bigint, tokenDecimals: bigint = ENIGMA_DECIMALS, precision: number = 2): string => {
  const factor = 10n ** tokenDecimals;
  const integerPart = value / factor;
  const decimalPart = value % factor;
  return `${integerPart}.${decimalPart.toString().padStart(parseInt(tokenDecimals.toString()), "0").slice(0, precision)}`;
};

export const stringify = (obj: any) =>
  JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? "0x" + value.toString(16) : value
  );

export const parse = (str: any) =>
  JSON.parse(str, (_, value) =>
    typeof value === "string" && value.startsWith("0x") ? BigInt(value) : value
  );


export const buildExplorerUrl = (txHash: string) => {
  return `${process.env.EXPLORER_BASE_URL}/tx/${txHash}`;
};
