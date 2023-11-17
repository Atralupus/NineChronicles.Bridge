import { captureException } from "@sentry/node";
import { Monitor } from ".";
import { IMonitorStateStore } from "../interfaces/monitor-state-store";
import { BlockHash } from "../types/block-hash";
import { ShutdownChecker } from "../types/shutdown-checker";
import { TransactionLocation } from "../types/transaction-location";

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

type ProcessRemainsResult<TEventData> = {
    nextBlockIndex: number;
    remainedEvents: RemainedEvent<TEventData>[];
};
type RemainedEvent<TEventData> = {
    blockHash: string;
    events: (TEventData & TransactionLocation)[];
};

export abstract class TriggerableMonitor<TEventData> extends Monitor<
    TEventData & TransactionLocation
> {
    private latestBlockNumber: number | undefined;

    private readonly _monitorStateStore: IMonitorStateStore;
    private readonly _shutdownChecker: ShutdownChecker;
    private readonly _delayMilliseconds: number;

    constructor(
        monitorStateStore: IMonitorStateStore,
        shutdownChecker: ShutdownChecker,
        delayMilliseconds: number = 15 * 1000,
    ) {
        super();

        this._monitorStateStore = monitorStateStore;
        this._shutdownChecker = shutdownChecker;
        this._delayMilliseconds = delayMilliseconds;
    }

    async *loop(): AsyncIterableIterator<{
        blockHash: BlockHash;
        events: (TEventData & TransactionLocation)[];
    }> {
        const nullableLatestBlockHash =
            await this._monitorStateStore.load("nineChronicles"); // FIXME
        if (nullableLatestBlockHash !== null) {
            this.latestBlockNumber = await this.getBlockIndex(
                nullableLatestBlockHash,
            );
        } else {
            this.latestBlockNumber = await this.getTipIndex();
        }

        while (!this._shutdownChecker.isShutdown()) {
            console.log(
                "shutdownChecker.isShutdown",
                this._shutdownChecker.isShutdown(),
            );
            try {
                const tipIndex = await this.getTipIndex();
                this.debug(
                    "Try to check trigger at",
                    this.latestBlockNumber + 1,
                );
                if (this.latestBlockNumber + 1 <= tipIndex) {
                    const trigerredBlockIndexes = this.triggerredBlocks(
                        this.latestBlockNumber + 1,
                    );

                    for (const blockIndex of trigerredBlockIndexes) {
                        this.debug("Execute triggerred block #", blockIndex);
                        const blockHash = await this.getBlockHash(blockIndex);

                        yield {
                            blockHash,
                            events: await this.getEvents(blockIndex),
                        };

                        await this._monitorStateStore.store(
                            "nineChronicles",
                            blockHash,
                        );
                    }

                    this.latestBlockNumber += 1;
                } else {
                    this.debug(
                        `Skip check trigger current: ${this.latestBlockNumber} / tip: ${tipIndex}`,
                    );

                    await delay(this._delayMilliseconds);
                }
            } catch (error) {
                this.error(
                    "Ignore and continue loop without breaking though unexpected error occurred:",
                    error,
                );
                captureException(error);
            }
        }
    }

    protected abstract processRemains(
        transactionLocation: TransactionLocation,
    ): Promise<ProcessRemainsResult<TEventData>>;

    protected abstract triggerredBlocks(blockIndex: number): number[];

    private debug(message?: unknown, ...optionalParams: unknown[]): void {
        console.debug(`[${this.constructor.name}]`, message, ...optionalParams);
    }

    private error(message?: unknown, ...optionalParams: unknown[]): void {
        console.error(`[${this.constructor.name}]`, message, ...optionalParams);
    }

    protected abstract getBlockIndex(blockHash: string): Promise<number>;

    protected abstract getBlockHash(blockIndex: number): Promise<string>;

    protected abstract getTipIndex(): Promise<number>;

    protected abstract getEvents(
        blockIndex: number,
    ): Promise<(TEventData & TransactionLocation)[]>;
}
