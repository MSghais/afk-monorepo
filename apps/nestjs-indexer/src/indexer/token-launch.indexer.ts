import { FieldElement, Transaction, BlockHeader, Event } from '@apibara/starknet';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'viem';
import constants from 'src/common/constants';
import { hash, shortString, uint256, validateAndParseAddress } from 'starknet';
import { TokenLaunchService } from 'src/services/token-launch/token-launch.service';
import { IndexerService } from './indexer.service';
import { ContractAddress } from 'src/common/types';

@Injectable()
export class TokenLaunchIndexer {
  private readonly logger = new Logger(TokenLaunchIndexer.name);
  private readonly eventKeys: string[];

  constructor(
    @Inject(TokenLaunchService)
    private readonly tokenLaunchService: TokenLaunchService,

    @Inject(IndexerService)
    private readonly indexerService: IndexerService,
  ) {
    this.eventKeys = [
      validateAndParseAddress(hash.getSelectorFromName('CreateLaunch')),
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
    this.logger.log('Received event TokenLaunch');
    const eventKey = validateAndParseAddress(event.keys[0].toString());

    switch (eventKey) {
      case validateAndParseAddress(hash.getSelectorFromName('CreateLaunch')):
        this.logger.log('Event name: CreateLaunch');
        await this.handleTokenLaunchEvent(header, event, transaction);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventKey}`);
    }
  }

  private async handleTokenLaunchEvent(
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

    const transactionHashFelt = transaction.meta?.transactionHash;
    const transactionHash = validateAndParseAddress(
      `0x${transactionHashFelt.toString()}`,
    ) as ContractAddress;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, callerFelt, tokenAddressFelt, quoteTokenAddressFelt] = event.keys;

    const ownerAddress = validateAndParseAddress(
      `0x${callerFelt.toString()}`,
    ) as ContractAddress;

    const tokenAddress = validateAndParseAddress(
      `0x${tokenAddressFelt.toString()}`,
    ) as ContractAddress;

    const quoteTokenAddress = validateAndParseAddress(
      `0x${quoteTokenAddressFelt.toString()}`,
    ) as ContractAddress;

    const [
      amountLow,
      amountHigh,
      priceLow,
      priceHigh,
      totalSupplyLow,
      totalSupplyHigh,
      slopeLow,
      slopeHigh,
      thresholdLiquidityLow,
      thresholdLiquidityHigh,
      bondingTypeFelt,
    ] = event.data;

    const amountRaw = uint256.uint256ToBN({
      low: amountLow.toString(),
      high: amountHigh.toString(),
    });
    const amount = formatUnits(amountRaw, constants.DECIMALS).toString();

    const priceRaw = uint256.uint256ToBN({
      low: priceLow.toString(),
      high: priceHigh.toString(),
    });
    const price = formatUnits(priceRaw, constants.DECIMALS);

    const totalSupplyRaw = uint256.uint256ToBN({
      low: totalSupplyLow.toString(),
      high: totalSupplyHigh.toString(),
    });
    const totalSupply = formatUnits(
      totalSupplyRaw,
      constants.DECIMALS,
    ).toString();

    const slopeRaw = uint256.uint256ToBN({
      low: slopeLow.toString(),
      high: slopeHigh.toString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const slope = formatUnits(slopeRaw, constants.DECIMALS).toString();

    const thresholdLiquidityRaw = uint256.uint256ToBN({
      low: thresholdLiquidityLow.toString(),
      high: thresholdLiquidityHigh.toString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const thresholdLiquidity = formatUnits(
      thresholdLiquidityRaw,
      constants.DECIMALS,
    ).toString();
    console.log('thresholdLiquidity', thresholdLiquidity);

    // const bondingType = bondingTypeFelt;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const bondingType = bondingTypeFelt
      ? shortString.decodeShortString(
          bondingTypeFelt.toString(),
        )
      : '';

    console.log('bondingType', bondingType);

    const data = {
      transactionHash,
      network: 'starknet-sepolia',
      blockNumber: Number(blockNumber),
      blockHash,
      blockTimestamp: new Date(Number(blockTimestamp?.getTime()) * 1000),
      memecoinAddress: tokenAddress,
      quoteToken: quoteTokenAddress,
      amount: Number(amount),
      totalSupply,
      price,
      ownerAddress,
      bondingType,
      thresholdLiquidity,
    };

    await this.tokenLaunchService.create(data);
  }
}
