export class LegoSet {
    constructor(
        public code: number,
        public price: number,
        public name: string,
    ) {}

    clone(): LegoSet {
        return new LegoSet(this.code, this.price, this.name)
    }

    toString(): string {
        return `${this.code} - ${this.price} PLN ${this.name}`
    }

    toFileRow(): string {
        return `${this.code};${this.price};${this.name}\n`
    }

    static fromFileRow(row: string): LegoSet {
        const [code, price, name] = row.split(';')
        return new LegoSet(+code, +price, name)
    }

    static empty(): LegoSet {
        return new LegoSet(0, 0, '')
    }
}
