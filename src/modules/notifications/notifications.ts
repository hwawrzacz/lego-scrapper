import { LegoSet } from '../../models/LegoSet.js'

export class Mailer {
    sendNotification(setsWithBetterPrice: LegoSet[]): void {
        if (setsWithBetterPrice.length === 0) return

        console.log(`Found ${setsWithBetterPrice.length} sets with better prices:`)
        setsWithBetterPrice.forEach((set: LegoSet) =>
            console.log(` - ${set.name} - ${set.price} PLN`)
        )
    }
}
