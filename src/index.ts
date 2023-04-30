// loads file from disk
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { LegoSet } from './models/LegoSet.mjs'
import {CheerioAPI, ParentNode} from 'cheerio'

const wantedLegoSetsFilePath: string = 'data/wanted-sets.txt'
const latestLegoSetsFilePath: string = 'data/latest.txt'
const bestLegoSetsFilePath: string = 'data/best.txt'
const websiteUrl: string = 'http://zklockow.pl/lego-speed-champions'
let updated: number = 0

performPirceCheck()

async function performPirceCheck(): Promise<void> {
    updated = 0
    const sets: LegoSet[] = getLegoSetsFromFile(wantedLegoSetsFilePath)
    let bestPriceSets: LegoSet[] = getLegoSetsFromFile(bestLegoSetsFilePath)
    const websiteDom: CheerioAPI = await getWebsiteBody(websiteUrl)
    const elementsOfWantedSets: ParentNode[] = getElementsOfWantedSets(sets, websiteDom)
    const latestSetsDetails: LegoSet[] = elementsOfWantedSets.map((element: ParentNode) => getSetDetailsFromElement(element))
    const setsWithBetterPrice: LegoSet[] = getSetsNumbersWithBetterPrice(latestSetsDetails, bestPriceSets)
        .map((number: number) => latestSetsDetails.find(set => set.code === number))
    bestPriceSets = bestPriceSets.length === 0 ? setsWithBetterPrice : bestPriceSets
    bestPriceSets = getNewBestSets(setsWithBetterPrice, bestPriceSets)
    saveSetsToFile(latestSetsDetails, latestLegoSetsFilePath)
    saveSetsToFile(bestPriceSets, bestLegoSetsFilePath)

    sendNotification(setsWithBetterPrice);
}

function getLegoSetsFromFile(path: string): LegoSet[] {
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

async function getWebsiteBody(url: string): Promise<CheerioAPI> {
    const response = await axios.get(url)
    const website = response.data
    return cheerio.load(website)
}

function getUrlsOfWantedSets(sets: LegoSet[], website: CheerioAPI): string[] {
    const mapper = (el: cheerio.Element) => el.attribs.href
    return mapElementsMatchingWantedSetsNumbers<string>(sets, website, mapper)
}

function getElementsOfWantedSets(sets: LegoSet[], website: CheerioAPI): ParentNode[] {
    const mapper = (el: cheerio.Element) => el.parent
    return mapElementsMatchingWantedSetsNumbers<cheerio.ParentNode>(sets, website, mapper)
}

function mapElementsMatchingWantedSetsNumbers<T>(sets: LegoSet[], website: CheerioAPI, mapperFunction: (el: cheerio.Element) => T): T[] {
    const elementSelector: string = '#BasLis .R > .Ri.Na'
    const setsNumbers: number[] = sets.map((legoSet: LegoSet) => legoSet.code)
    return website(elementSelector)
        .filter((i: number, el: cheerio.Element) => filterElementsBySetNumber(el, setsNumbers))
        .map((i: number, el: cheerio.Element) => mapperFunction(el))
        .get()
}

function filterElementsBySetNumber(el: cheerio.Element, setsNumbers: number[]): boolean {
    const titleValue = el.attribs.title
        .split(' ')
        .map(val => +val)
        .filter(val => !isNaN(val))

    return titleValue.some(value => setsNumbers.includes(value))
}

function getSetDetailsFromElement(element: ParentNode): LegoSet {
    const itemNameSelector: string = 'a.Ri.Na'
    const itemPriceSelector: string = 'a.Ri.Dt > .pr > .pp > span'
    const legoSetElement = cheerio.load(element)
    const [, , , code, ...name] = legoSetElement(itemNameSelector).text().split(' ')
    const price: number = +legoSetElement(itemPriceSelector).text().replace(',', '.')
    return new LegoSet(+code, price, name.join(' '))
}

function getSetsNumbersWithBetterPrice(latestSets: LegoSet[], bestSets: LegoSet[]): number[] {
    return latestSets
        .filter((latestSet: LegoSet) => {
            const bestSet: LegoSet = bestSets.find((set: LegoSet) => set.code === latestSet.code)
            return !bestSet || latestSet.price < bestSet.price
        })
        .map((latestSet: LegoSet) => latestSet.code)
}

function getNewBestSets(setsWithBetterPrice: LegoSet[], bestSets: LegoSet[]): LegoSet[] {
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
    });

    return newBestSets;
}

function saveSetsToFile(sets: LegoSet[], path: string): void {
    try {
        fs.writeFileSync(path, sets.map(set => set.toFileRow()).join(''))
    } catch (err: unknown) {
        console.error(`Error while saving file "${path}"`)
    }
}

function sendNotification(setsWithBetterPrice: LegoSet[]): void {
    if (setsWithBetterPrice.length === 0) return

    console.log(`Updated ${setsWithBetterPrice.length} sets:`)
    setsWithBetterPrice.forEach((set: LegoSet) =>
        console.log(` - ${set.name} - ${set.price} PLN`)
    )
}
