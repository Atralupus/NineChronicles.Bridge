import test from "node:test";
import { RawPrivateKey } from "@planetarium/account";
import { Currency } from "@planetarium/tx";
import Decimal from "decimal.js";
import { HeadlessGraphQLClient } from "./headless-graphql-client";
import { Minter } from "./minter";
import { Signer } from "./signer";
import { HeadlessTxPool } from "./txpool/headless";

test("mint fav", async () => {
    const account = RawPrivateKey.fromHex("");
    const headlessClient = new HeadlessGraphQLClient(
        {
            id: "0x100000000000",
            rpcEndpoints: {
                "headless.gql": [
                    "https://heimdall-internal-rpc-1.nine-chronicles.com/graphql",
                ],
                "headless.grpc": [],
            },
        },
        1,
    );
    const signer = new Signer(
        account,
        new HeadlessTxPool(headlessClient),
        await headlessClient.getGenesisHash(),
    );

    const minter = new Minter(signer);
    const amount = new Decimal("0.01").mul(100).floor();
    const ncg: Currency = {
        decimalPlaces: 0x02,
        minters: null,
        ticker: "NCG",
        totalSupplyTrackable: false,
        maximumSupply: null,
    };
    await minter.mintAssets(
        [
            {
                recipient: "0x019101FEec7ed4f918D396827E1277DEda1e20D4",
                amount: {
                    currency: ncg,
                    rawValue: BigInt(amount.toNumber()),
                },
            },
        ],
        null,
    );
});

test("mint fis", async () => {
    const account = RawPrivateKey.fromHex("");
    const headlessClient = new HeadlessGraphQLClient(
        {
            id: "0x100000000000",
            rpcEndpoints: {
                "headless.gql": [
                    "https://heimdall-internal-rpc-1.nine-chronicles.com/graphql",
                ],
                "headless.grpc": [],
            },
        },
        1,
    );
    const signer = new Signer(
        account,
        new HeadlessTxPool(headlessClient),
        await headlessClient.getGenesisHash(),
    );

    const minter = new Minter(signer);

    await minter.mintAssets(
        [
            {
                recipient: "0x37fd092455B529cFAE3Bf3b58201cE029231cDBe",
                fungibleItemId:
                    "1a755098a2bc0659a063107df62e2ff9b3cdaba34d96b79519f504b996f53820",
                count: 100,
            },
        ],
        null,
    );
});
