import { FieldElement, Transaction, BlockHeader, Event } from '@apibara/starknet';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'viem';
import constants from 'src/common/constants';
import { hash, shortString, uint256, validateAndParseAddress } from 'starknet';
import { DeployTokenService } from 'src/services/deploy-token/deploy-token.service';
import { IndexerService } from './indexer.service';
import { ContractAddress } from 'src/common/types';

@Injectable()
export class DeployTokenIndexer {
  private readonly logger = new Logger(DeployTokenIndexer.name);
  private readonly eventKeys: string[];

  constructor(
    @Inject(DeployTokenService)
    private readonly deployTokenService: DeployTokenService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService,
  ) {
    this.eventKeys = [
      validateAndParseAddress(hash.getSelectorFromName('CreateToken')),
    ];
  }

  async onModuleInit() {
    this.indexerService.registerIndexer(
      this.eventKeys,
      this.handleEvents.bind(this),
    );
  }

  private async handleEvents(
    header: BlockHeader,
    event: Event,
    transaction: Transaction,
  ) {
    this.logger.log('Received event');
    const eventKey = validateAndParseAddress(event.keys[0].toString());

    switch (eventKey) {
      case validateAndParseAddress(hash.getSelectorFromName('CreateToken')):
        this.logger.log('Event name: CreateToken');
        await this.handleCreateTokenEvent(header, event, transaction);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventKey}`);
    }
  }

  private isNumeric = (str: string): boolean => {
    return /^\d+$/.test(str);
  };

  private isValidChar = (char: string): boolean => {
    return /^[a-zA-Z0-9\s\-_.!@#$%^&*()]+$/.test(char);
  };

  private cleanString = (str: string): string => {
    return str
      .split('')
      .filter((char) => this.isValidChar(char))
      .join('')
      .trim();
  };

  private async handleCreateTokenEvent(
    header: BlockHeader,
    event: Event,
    transaction: Transaction,
  ) {
    const {
      blockNumber,
      blockHash: blockHashFelt,
      timestamp: blockTimestamp,
    } = header;

    const blockHash = validateAndParseAddress(
      `0x${blockHashFelt.toString()}`,
    ) as ContractAddress;

    const transactionHash = transaction.meta.transactionHash;
    const [, callerFelt, tokenAddressFelt] = event.keys;

    const ownerAddress = validateAndParseAddress(
      `0x${callerFelt.toString()}`,
    ) as ContractAddress;

    const tokenAddress = validateAndParseAddress(
      `0x${tokenAddressFelt.toString()}`,
    ) as ContractAddress;

    let i = 1;
    let symbol = '';
    
    while (i < event.data.length) {
      const part = event.data[i];
      const decodedPart = shortString.decodeShortString(
        part.toString(),
      );

      if (this.isNumeric(decodedPart)) {
        i++;
        break;
      }

      symbol += decodedPart;
      i++;
    }

    symbol = this.cleanString(symbol);

    const part = event.data[i];
    const decodedPart = shortString.decodeShortString(
      part.toString(),
    );

    if (this.isNumeric(decodedPart)) {
      i++;
    }

    let name = '';

    while (i < event.data.length - 5) {
      const part = event.data[i];
      const decodedPart = shortString.decodeShortString(
        part.toString(),
      );

      if (this.isNumeric(decodedPart)) {
        i++;
        break;
      }

      name += decodedPart;
      i++;
    }

    name = this.cleanString(name);
      
    const initialSupplyLow = event.data[i++];
    const initialSupplyHigh = event.data[i++];
    const initialSupplyRaw = uint256.uint256ToBN({
      low: initialSupplyLow.toString(),
      high: initialSupplyHigh.toString(),
    });
    const initialSupply = formatUnits(
      initialSupplyRaw,
      constants.DECIMALS,
    ).toString();

    console.log('initial supply', initialSupply);

    const totalSupplyLow = event.data[i++];
    const totalSupplyHigh = event.data[i];
    const totalSupplyRaw = uint256.uint256ToBN({
      low: totalSupplyLow.toString(),
      high: totalSupplyHigh.toString(),
    });
    const totalSupply = formatUnits(
      totalSupplyRaw,
      constants.DECIMALS,
    ).toString();

    console.log('total supply', totalSupply);

    const data = {
      transactionHash,
      network: 'starknet-sepolia',
      blockNumber: Number(blockNumber),
      blockHash,
      blockTimestamp: new Date(Number(blockTimestamp?.getTime()) * 1000),
      memecoinAddress: tokenAddress,
      ownerAddress,
      name,
      symbol,
      initialSupply,
      totalSupply,
    };

    await this.deployTokenService.create(data);
  }
}
