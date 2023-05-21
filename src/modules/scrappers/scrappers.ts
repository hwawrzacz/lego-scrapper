// loads file from disk
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { CheerioAPI, ParentNode } from 'cheerio'
import { LegoSet } from '../../models/LegoSet.js'

export class Scrappers {
    private wantedLegoSetsFilePath: string = 'data/wanted-sets.txt'
    private latestLegoSetsFilePath: string = 'data/latest.txt'
    private bestLegoSetsFilePath: string = 'data/best.txt'
    private websiteUrl: string = 'http://zklockow.pl/lego-speed-champions'
    private updated: number = 0

    public performPirceCheck = async (): Promise<void> => {
        console.log('Checking')
        this.updated = 0
        const sets: LegoSet[] = this.getLegoSetsFromFile(this.wantedLegoSetsFilePath)
        let bestPriceSets: LegoSet[] = this.getLegoSetsFromFile(this.bestLegoSetsFilePath)
        const websiteDom: CheerioAPI = await this.getWebsiteBody(this.websiteUrl)
        const elementsOfWantedSets: ParentNode[] = this.getElementsOfWantedSets(sets, websiteDom)
        const latestSetsDetails: LegoSet[] = elementsOfWantedSets.map((element: ParentNode) => this.getSetDetailsFromElement(element))
        const setsWithBetterPrice: LegoSet[] = this.getSetsNumbersWithBetterPrice(latestSetsDetails, bestPriceSets)
            .map((number: number) => latestSetsDetails.find(set => set.code === number))
        bestPriceSets = bestPriceSets.length === 0 ? setsWithBetterPrice : bestPriceSets
        bestPriceSets = this.getNewBestSets(setsWithBetterPrice, bestPriceSets)
        this.saveSetsToFile(latestSetsDetails, this.latestLegoSetsFilePath)
        this.saveSetsToFile(bestPriceSets, this.bestLegoSetsFilePath)

        if (setsWithBetterPrice.length > 0) {
            console.log('Better price found')
        } else {
            console.log('No better price')
        }
    }

    private getLegoSetsFromFile = (path: string): LegoSet[] => {
        try {
            const file = fs.readFileSync(path, 'utf8')
            return file
                .split('\n')
                .filter((row) => row.length > 0)
                .map((setRow) =>
                    LegoSet.fromFileRow(setRow)
                )
        } catch(err: unknown) {
            console.error(`File ${path} not found`)
            return []
        }
    }

    private getWebsiteBody = async  (url: string): Promise<CheerioAPI> => {
        const response = await axios.get(url)
        const website = response.data
        return cheerio.load(website)
    }

    private getUrlsOfWantedSets = (sets: LegoSet[], website: CheerioAPI): string[] => {
        const mapper = (el: cheerio.Element) => el.attribs.href
        return this.mapElementsMatchingWantedSetsNumbers<string>(sets, website, mapper)
    }

    private getElementsOfWantedSets(sets: LegoSet[], website: CheerioAPI): ParentNode[] {
        const mapper = (el: cheerio.Element) => el.parent
        return this.mapElementsMatchingWantedSetsNumbers<cheerio.ParentNode>(sets, website, mapper)
    }

    private mapElementsMatchingWantedSetsNumbers<T>(sets: LegoSet[], website: CheerioAPI, mapperFunction: (el: cheerio.Element) => T): T[] {
        const elementSelector: string = '#BasLis .R > .Ri.Na'
        const setsNumbers: number[] = sets.map((legoSet: LegoSet) => legoSet.code)
        return website(elementSelector)
            .filter((i: number, el: cheerio.Element) => this.filterElementsBySetNumber(el, setsNumbers))
            .map((i: number, el: cheerio.Element) => mapperFunction(el))
            .get()
    }

    private filterElementsBySetNumber(el: cheerio.Element, setsNumbers: number[]): boolean {
        const titleValue = el.attribs.title
            .split(' ')
            .map(val => +val)
            .filter(val => !isNaN(val))

        return titleValue.some(value => setsNumbers.includes(value))
    }

    private getSetDetailsFromElement(element: ParentNode): LegoSet {
        const itemNameSelector: string = 'a.Ri.Na'
        const itemPriceSelector: string = 'a.Ri.Dt > .pr > .pp > span'
        const legoSetElement = cheerio.load(element)
        const [, , , code, ...name] = legoSetElement(itemNameSelector).text().split(' ')
        const price: number = +legoSetElement(itemPriceSelector).text().replace(',', '.')
        return new LegoSet(+code, price, name.join(' '))
    }

    private getSetsNumbersWithBetterPrice(latestSets: LegoSet[], bestSets: LegoSet[]): number[] {
        return latestSets
            .filter((latestSet: LegoSet) => {
                const bestSet: LegoSet = bestSets.find((set: LegoSet) => set.code === latestSet.code)
                return !bestSet || latestSet.price < bestSet.price
            })
            .map((latestSet: LegoSet) => latestSet.code)
    }

    private getNewBestSets(setsWithBetterPrice: LegoSet[], bestSets: LegoSet[]): LegoSet[] {
        const newBestSets: LegoSet[] = []
        bestSets.forEach((bestSet: LegoSet) => {
            const setWithBetterPrice: LegoSet = setsWithBetterPrice.find((set: LegoSet): boolean => set.code === bestSet.code)
            const newBestSet: LegoSet = bestSet.clone()
            if (setWithBetterPrice) {
                newBestSet.price = setWithBetterPrice.price
                newBestSets.push(newBestSet)
                return
            } else {
                newBestSets.push(bestSet.clone())
            }
        })

        return newBestSets
    }

    private saveSetsToFile(sets: LegoSet[], path: string): void {
        try {
            fs.writeFileSync(path, sets.map(set => set.toFileRow()).join(''))
        } catch (err: unknown) {
            console.error(`Error while saving file "${path}"`)
        }
    }
}
