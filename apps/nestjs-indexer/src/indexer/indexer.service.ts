import { Injectable, Logger } from '@nestjs/common';
import { createClient, DataFinality, NodeClient } from '@apibara/protocol';
import {
  BlockHeader,
  FieldElement,
  Filter,
  StarknetStream,
} from '@apibara/starknet';
import { validateAndParseAddress } from 'starknet';
import constants from 'src/common/constants';
import { env } from 'src/common/env';
import { IndexerConfig } from './interfaces';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly client: NodeClient;
  private configs: IndexerConfig[] = [];

  constructor(private readonly prismaService: PrismaService) {
    this.client = new NodeClient({
      url: env.indexer.dnaClientUrl,
      clientOptions: {
        'grpc.max_receive_message_length':
          constants.apibara.MAX_RECEIVE_MESSAGE_LENGTH,
      },
      token: env.indexer.dnaToken,
    });
  }

  onModuleInit() {
    this.startIndexer();
  }

  registerIndexer(eventKeys: string[], handler: (data: any) => Promise<void>) {
    this.configs.push({ eventKeys, handler });
  }

  private async startIndexer() {
    if (this.configs.length === 0) {
      this.logger.warn('No indexers registered. Skipping indexer start.');
      return;
    }

    this.logger.log('Starting indexer...');

    const indexerStats = await this.prismaService.indexerStats.findFirst({
      orderBy: { lastBlockScraped: 'desc' },
    });

    const startingBlock = indexerStats
      ? indexerStats.lastBlockScraped
      : constants.STARTING_BLOCK;

    console.log(startingBlock);



    const args = {
      stream: 'https://starknet.preview.apibara.org',
    }
    const contractAddressFieldElements = [
      validateAndParseAddress(constants.contracts.sepolia.LAUNCHPAD_ADDRESS),
      validateAndParseAddress(constants.contracts.sepolia.NAMESERVICE_ADDRESS),
      validateAndParseAddress(
        constants.contracts.sepolia.ESCROW_DEPOSIT_ADDRESS,
      ),
      // ].map((address) => FieldElement.fromBigInt(BigInt(address)));
    ].map((address) => BigInt(address));

    const client = createClient(StarknetStream, args.stream);

    const response = await client.status();
    console.log(response);

    // validateAndParseAddress(constants.contracts.sepolia.LAUNCHPAD_ADDRESS)
    // validateAndParseAddress(constants.contracts.sepolia.NAMESERVICE_ADDRESS)
    const filter = Filter.make({
      transactions: [{ includeReceipt: true }],
      messages: [{}],
      events: [
        // {
        //   contractAddress: constants.contracts.sepolia.LAUNCHPAD_ADDRESS,
        // },
      ],
      storageDiffs: [{}],
      contractChanges: [{}],
      nonceUpdates: [{}],
    });



    const request = StarknetStream.Request.make({
      filter: [filter],
      finality: "pending",
      startingCursor: {
        orderKey: 1_083_705n,
      },
    });

    const combinedFilter = this.combineFilters();

    this.client.configure({
      filter: combinedFilter,
      batchSize: 1,
      // fin
      // finality: DataFinality.,
      // cursor: StarkNetCursor.createWithBlockNumber(Number(startingBlock)),
    });


    for await (const message of client.streamData(request, {
      timeout: 40_000,
    })) {
      switch (message._tag) {
        case "data": {
          console.info("Data", message.data.endCursor?.orderKey);

          let events = 0;
          for (const block of message.data.data) {
            // assert(block !== null);
            events += block.events.length ?? 0;
            console.info(
              `Block n=${block.header?.blockNumber} h=${block.header?.blockHash}`,
            );
            // );
            for (const event of block.events) {
              // const { args, transactionHash } = decodeEvent({
              //   abi,
              //   eventName: "Transfer",
              //   event,
              // });
              // consola.info(
              //   `${prettyAddress(args.from)} -> ${prettyAddress(args.to)} ${formatUnits(args.value, 6)} ${colors.gray(transactionHash ?? "")}`,
              // );
            }
          }

          break;
        }
        case "systemMessage": {
          switch (message.systemMessage.output?._tag) {
            case "stdout": {
              console.info(message.systemMessage.output.stdout);
              break;
            }
            case "stderr": {
              console.warn(message.systemMessage.output.stderr);
              break;
            }
          }
          break;
        }
      }

      for await (const message of this.client) {
        this.logger.debug(`Received message: ${message.message}`);
        if (message.message === 'data') {
          // await this.handleDataMessage(message.data);

          // await this.prismaService.indexerStats.create({
          //   data: {
          //     lastBlockScraped: Number(block.header.blockNumber),
          //     lastTx: hash,
          //     lastTimestamp: new Date(
          //       Number(block.header.timestamp.seconds) * 1000,
          //     ),
          //   },
          // });
        }
      }
    }
  }

  private combineFilters() {
    const combinedFilter = Filter.make({

    });

    const contractAddressFieldElements = [
      validateAndParseAddress(constants.contracts.sepolia.LAUNCHPAD_ADDRESS),
      validateAndParseAddress(constants.contracts.sepolia.NAMESERVICE_ADDRESS),
      validateAndParseAddress(
        constants.contracts.sepolia.ESCROW_DEPOSIT_ADDRESS,
      ),
      // ].map((address) => FieldElement.fromBigInt(BigInt(address)));
    ].map((address) => BigInt(address));

    contractAddressFieldElements.forEach((contractAddressFieldElement) => {
      // combinedFilter.addEvent((event) =>
      //   event.withFromAddress(contractAddressFieldElement),
      // );
    });

    // return combinedFilter.toUint8Array();
    // return combinedFilter.encode();
  }

  // private async handleDataMessage(dataMessage: any) {
  //   const { data } = dataMessage;
  //   let hash = '0x';
  //   for (const item of data) {
  //     const block = BlockHeader.make(item);
  //     for (const event of block.events) {
  //       // const eventKey = FieldElement.toHex(event.event.keys[0]);
  //       const eventKey = event.event.keys[0];

  //       const matchingConfigs = this.configs.filter((config) =>
  //         config.eventKeys.includes(eventKey),
  //       );

  //       for (const config of matchingConfigs) {
  //         try {
  //           await config.handler(block.header, event.event, event.transaction);
  //         } catch (error) {
  //           this.logger.error(
  //             `Failed to handle event`,
  //             {
  //               eventKey,
  //               eventIndex: event.event.index.toString(),
  //               blockNumber: block.header.blockNumber.toString(),
  //               event: event.transaction.meta.hash,
  //               // transactionHash: FieldElement.toHex(
  //               //   event.transaction.meta.hash,
  //               // ),
  //               message: error.message,
  //             },
  //             error.stack,
  //           );
  //         }
  //       }
  //       if (event.receipt.transactionHash)
  //         // hash = FieldElement.toHex(event.receipt.transactionHash);
  //         hash = event.receipt.transactionHash;

  //     }

  //     // await this.prismaService.indexerStats.create({
  //     //   data: {
  //     //     lastBlockScraped: Number(block.header.blockNumber),
  //     //     lastTx: hash,
  //     //     lastTimestamp: new Date(
  //     //       Number(block.header.timestamp.seconds) * 1000,
  //     //     ),
  //     //   },
  //     // });
  //   }
  // }
}
