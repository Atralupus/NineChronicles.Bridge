import { IObserver } from ".";
import {
    IFungibleAssetValues,
    IFungibleItems,
    IMinter,
} from "../interfaces/minter";
import { ISlackMessageSender } from "../slack";
import { SlackBot } from "../slack/bot";
import { BridgeEvent } from "../slack/messages/bridge-event";
import { BlockHash } from "../types/block-hash";
import { GarageUnloadEvent } from "../types/garage-unload-event";
import { TransactionLocation } from "../types/transaction-location";

export class GarageObserver
    implements
        IObserver<{
            blockHash: BlockHash;
            events: (GarageUnloadEvent & TransactionLocation)[];
        }>
{
    private readonly _slackbot: ISlackMessageSender;
    private readonly _minter: IMinter;

    constructor(slackbot: ISlackMessageSender, minter: IMinter) {
        this._slackbot = slackbot;
        this._minter = minter;
    }

    async notify(data: {
        blockHash: BlockHash;
        events: (GarageUnloadEvent & TransactionLocation)[];
    }): Promise<void> {
        const { events } = data;

        for (const {
            blockHash,
            txId,
            planetID,
            fungibleAssetValues,
            fungibleItems,
            memo,
        } of events) {
            const {
                agentAddress,
                avatarAddress,
                memo: memoForMinter,
            } = parseMemo(memo);

            const requests: (IFungibleAssetValues | IFungibleItems)[] = [];
            for (const fa of fungibleAssetValues) {
                requests.push({
                    recipient: agentAddress,
                    amount: fa[1],
                });
            }

            for (const fi of fungibleItems) {
                requests.push({
                    recipient: avatarAddress,
                    fungibleItemId: fi[1],
                    count: fi[2],
                });
            }

            if (requests.length !== 0) {
                const resTxId = await this._minter.mintAssets(
                    // @ts-ignore
                    requests,
                    memoForMinter,
                );
                await this._slackbot.sendMessage(
                    new BridgeEvent(
                        "MINT",
                        [planetID, txId],
                        [this._minter.getMinterPlanet(), resTxId],
                    ),
                );
            }
        }
    }
}
function parseMemo(memo: string): {
    agentAddress: string;
    avatarAddress: string;
    memo: string;
} {
    const parsed = JSON.parse(memo);

    return {
        agentAddress: parsed[0],
        avatarAddress: parsed[1],
        memo: parsed[2],
    };
}
