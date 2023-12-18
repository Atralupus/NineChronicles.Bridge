import { Address } from "@planetarium/account";
import { RecordView, Value } from "@planetarium/bencodex";
import { encodeCurrency } from "@planetarium/tx";
import { IFungibleAssetValues, IFungibleItems } from "./interfaces/minter";

function encodeMintSpec(value: IFungibleAssetValues | IFungibleItems): Value {
    if ((value as IFungibleAssetValues).amount !== undefined) {
        const favs = value as IFungibleAssetValues;
        return [
            Address.fromHex(favs.recipient, true).toBytes(),
            [encodeCurrency(favs.amount.currency), favs.amount.rawValue],
            null,
        ];
    } else {
        const fis = value as IFungibleItems;
        return [
            Address.fromHex(fis.recipient, true).toBytes(),
            null,
            [Buffer.from(fis.fungibleItemId, "hex"), BigInt(fis.count)],
        ];
    }
}

export function encodeMintAssetsAction(
    assets: (IFungibleAssetValues | IFungibleItems)[],
    memo: string | null,
): RecordView {
    return new RecordView(
        {
            type_id: "mint_assets",
            values: [memo, ...assets.map(encodeMintSpec)],
        },
        "text",
    );
}
