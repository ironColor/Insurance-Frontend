import { areaList } from '@vant/area-data'

export type RegionOption = {
  code: string
  name: string
}

const toOptions = (items: Record<string, string>): RegionOption[] =>
  Object.entries(items).map(([code, name]) => ({ code, name }))

const provinces = toOptions(areaList.province_list)
const cities = toOptions(areaList.city_list)
const districts = toOptions(areaList.county_list)

export function getRegionOptions(parentCode?: string): RegionOption[] {
  if (!parentCode) return provinces
  if (areaList.province_list[parentCode]) {
    return cities.filter((item) => item.code.slice(0, 2) === parentCode.slice(0, 2))
  }
  if (areaList.city_list[parentCode]) {
    return districts.filter((item) => item.code.slice(0, 4) === parentCode.slice(0, 4))
  }
  return []
}

export function getRegionPath(names: string[]): RegionOption[] {
  const path: RegionOption[] = []
  for (const name of names.slice(0, 3)) {
    const options = getRegionOptions(path[path.length - 1]?.code)
    const match = options.find((item) => item.name === name)
    if (!match) break
    path.push(match)
  }
  return path
}
