import { FieldElement, BlockHeader, Event, Transaction } from '@apibara/starknet';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'viem';
import constants from 'src/common/constants';
import { hash, uint256, validateAndParseAddress } from 'starknet';
import { IndexerService } from './indexer.service';
import { ContractAddress } from 'src/common/types';
import { ClaimUserShareService } from 'src/services/claim-user-share/claim-share.service';

@Injectable()
export class ClaimUserShareIndexer {
  private readonly logger = new Logger(ClaimUserShareIndexer.name);
  private readonly eventKeys: string[];

  constructor(
    @Inject(ClaimUserShareService)
    private readonly claimUserShareService: ClaimUserShareService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService,
  ) {
    this.eventKeys = [
      validateAndParseAddress(hash.getSelectorFromName('TokenClaimed')),
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
    this.logger.log('Received event claim user share');
    const eventKey = validateAndParseAddress(event.keys[0].toString());

    switch (eventKey) {
      case validateAndParseAddress(hash.getSelectorFromName('TokenClaimed')):
        this.logger.log('Event name: TokenClaimed');
        await this.handleClaimUserShareEvent(header, event, transaction);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventKey}`);
    }
  }

  // TODO
  // finish handle claim event
  private async handleClaimUserShareEvent(
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
      lastPriceLow,
      lastPriceHigh,
      timestampFelt,
      quoteAmountLow,
      quoteAmountHigh,
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
      low: quoteAmountLow.toString(),
      high: quoteAmountHigh.toString(),
    });
    const quoteAmount = formatUnits(
      quoteAmountRaw,
      constants.DECIMALS,
    ).toString();

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
      transactionType: 'buy',
      tokenAddress,
    };

    await this.claimUserShareService.create(data);
  }
}
