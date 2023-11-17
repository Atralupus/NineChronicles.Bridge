import { Address, RawPrivateKey } from "@planetarium/account";
import "dotenv/config";
import { AssetBurner } from "./asset-burner";
import { AssetTransfer } from "./asset-transfer";
import { HeadlessGraphQLClient } from "./headless-graphql-client";
import { IMonitorStateStore } from "./interfaces/monitor-state-store";
import { Minter } from "./minter";
import { AssetsTransferredMonitor } from "./monitors/assets-transferred-monitor";
import { GarageUnloadMonitor } from "./monitors/garage-unload-monitor";
import { AssetDownstreamObserver } from "./observers/asset-downstream-observer";
import { AssetTransferredObserver } from "./observers/asset-transferred-observer";
import { GarageObserver } from "./observers/garage-observer";
import { ShutdownHandler } from "./shutdown-handler";
import { Signer } from "./signer";
import { Sqlite3MonitorStateStore } from "./sqlite3-monitor-state-store";

(async () => {
    const upstreamGQLClient = new HeadlessGraphQLClient(
        process.env.NC_UPSTREAM_GQL_ENDPOINT,
        3,
    );
    const downstreamGQLClient = new HeadlessGraphQLClient(
        process.env.NC_DOWNSTREAM_GQL_ENDPOINT,
        3,
    );
    const monitorStateStore: IMonitorStateStore =
        await Sqlite3MonitorStateStore.open(
            process.env.MONITOR_STATE_STORE_PATH,
        );

    const shutdownHandler = new ShutdownHandler();
    process.on("SIGTERM", () => shutdownHandler.shutdown());
    process.on("SIGINT", () => shutdownHandler.shutdown());

    const upstreamAssetsTransferredMonitorMonitor =
        new AssetsTransferredMonitor(
            monitorStateStore,
            shutdownHandler,
            upstreamGQLClient,
            Address.fromHex(process.env.NC_VAULT_ADDRESS),
        );
    const downstreamAssetsTransferredMonitorMonitor =
        new AssetsTransferredMonitor(
            monitorStateStore,
            shutdownHandler,
            downstreamGQLClient,
            Address.fromHex(process.env.NC_VAULT_ADDRESS),
        );
    const garageMonitor = new GarageUnloadMonitor(
        monitorStateStore,
        shutdownHandler,
        upstreamGQLClient,
        Address.fromHex(process.env.NC_VAULT_ADDRESS),
        Address.fromHex(process.env.NC_VAULT_AVATAR_ADDRESS),
    );

    const upstreamAccount = RawPrivateKey.fromHex(
        process.env.NC_UPSTREAM_PRIVATE_KEY,
    );
    const downstreamAccount = RawPrivateKey.fromHex(
        process.env.NC_DOWNSTREAM_PRIVATE_KEY,
    );

    const upstreamSigner = new Signer(upstreamAccount, upstreamGQLClient);
    const downstreamSigner = new Signer(downstreamAccount, downstreamGQLClient);

    const minter = new Minter(downstreamSigner);

    const upstreamTransfer = new AssetTransfer(upstreamSigner);
    const downstreamBurner = new AssetBurner(downstreamSigner);

    upstreamAssetsTransferredMonitorMonitor.attach(
        new AssetTransferredObserver(minter),
    );

    downstreamAssetsTransferredMonitorMonitor.attach(
        new AssetDownstreamObserver(upstreamTransfer, downstreamBurner),
    );

    garageMonitor.attach(new GarageObserver(minter));

    upstreamAssetsTransferredMonitorMonitor.run();
    downstreamAssetsTransferredMonitorMonitor.run();
    garageMonitor.run();
})().catch((error) => {
    console.error(error);
    process.exit(-1);
});
