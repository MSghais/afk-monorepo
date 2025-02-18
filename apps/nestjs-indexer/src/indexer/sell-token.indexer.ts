import { FieldElement, Transaction, Event, BlockHeader } from '@apibara/starknet';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'viem';
import constants from 'src/common/constants';
import { hash, uint256, validateAndParseAddress } from 'starknet';
import { SellTokenService } from 'src/services/sell-token/sell-token.service';
import { IndexerService } from './indexer.service';
import { ContractAddress } from 'src/common/types';

@Injectable()
export class SellTokenIndexer {
  private readonly logger = new Logger(SellTokenIndexer.name);
  private readonly eventKeys: string[];

  constructor(
    @Inject(SellTokenService)
    private readonly sellTokenService: SellTokenService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService,
  ) {
    this.eventKeys = [
      validateAndParseAddress(hash.getSelectorFromName('SellToken')),
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
    transaction:Transaction,
  ) {
    this.logger.log('Received event');
    const eventKey = validateAndParseAddress(event.keys[0].toString());

    switch (eventKey) {
      case validateAndParseAddress(hash.getSelectorFromName('SellToken')):
        this.logger.log('Event name: SellToken');
        await this.handleSellTokenEvent(header, event, transaction);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventKey}`);
    }
  }

  private async handleSellTokenEvent(
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

    const transferId = `${transactionHash}_${event.eventIndex}`;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, callerFelt, tokenAddressFelt] = event.keys;

    const ownerAddress = validateAndParseAddress(
      `0x${callerFelt.toString()}`,
    ) as ContractAddress;

    const tokenAddress = validateAndParseAddress(
      `0x${tokenAddressFelt.toString()}`,
    ) as ContractAddress;

    const [
      amountLow,
      amountHigh,
      priceLow,
      priceHigh,
      protocolFeeLow,
      protocolFeeHigh,
      creatorFeeLow,
      creatorFeeHigh,
      timestampFelt,
      lastPriceLow,
      lastPriceHigh,
      coinAmountLow,
      coinAmountHigh,
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

    const protocolFeeRaw = uint256.uint256ToBN({
      low: protocolFeeLow.toString(),
      high: protocolFeeHigh.toString(),
    });
    const protocolFee = formatUnits(
      protocolFeeRaw,
      constants.DECIMALS,
    ).toString();

    const lastPriceRaw = uint256.uint256ToBN({
      low: lastPriceLow.toString(),
      high: lastPriceHigh.toString(),
    });
    const lastPrice = formatUnits(lastPriceRaw, constants.DECIMALS).toString();

    const quoteAmountRaw = uint256.uint256ToBN({
      low: amountLow.toString(),
      high: amountHigh.toString(),
    });
    const quoteAmount = formatUnits(
      quoteAmountRaw,
      constants.DECIMALS,
    ).toString();

    let coinAmountRaw = quoteAmountRaw;
    let coinAmount = quoteAmount;

    // TODO fix
    // New version upgrade with coin amount sell
    if (coinAmountLow && coinAmountHigh) {
      coinAmountRaw = uint256.uint256ToBN({
        low: coinAmountLow.toString(),
        high: coinAmountHigh.toString(),
      });
      coinAmount = formatUnits(
        coinAmountRaw ?? quoteAmountRaw,
        constants.DECIMALS,
      ).toString();
    }

    const timestamp = new Date(
      Number(timestampFelt.toString()) * 1000,
    );

    const data = {
      transferId,
      network: 'starknet-sepolia',
      transactionHash,
      blockNumber: Number(blockNumber),
      blockHash,
      blockTimestamp: new Date(Number(blockTimestamp?.getTime()) * 1000),
      ownerAddress,
      memecoinAddress: tokenAddress,
      amount: Number(amount),
      price,
      protocolFee,
      lastPrice,
      quoteAmount,
      timestamp,
      transactionType: 'sell',
      coinAmount: Number(coinAmount),
    };

    await this.sellTokenService.create(data);
  }
}
