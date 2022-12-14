import { IAliGetFileModel } from '../aliapi/alimodels'
import { DirData } from '../store/treestore'


export function OrderNode(order: string, list: DirData[]) {
  const orders = order.split(' ')
  const orderby = orders[0].toLowerCase()
  order = orders[1].toLowerCase()
  if (orderby == 'size' && order == 'asc') return OrderBySizeAsc(list)
  if (orderby == 'size' && order == 'desc') return OrderBySizeDesc(list)
  if (orderby == 'updated_at' && order == 'asc') return OrderByTimeAsc(list)
  if (orderby == 'updated_at' && order == 'desc') return OrderByTimeDesc(list)
  if (orderby == 'name' && order == 'asc') return OrderByNameAsc(list)
  if (orderby == 'name' && order == 'desc') return OrderByNameDesc(list)
  return list
}

export function OrderDir(orderby: string, order: string, list: IAliGetFileModel[]) {
  orderby = orderby.toLowerCase()
  order = order.toLowerCase()
  if (orderby == 'size' && order == 'asc') return OrderBySizeAsc(list)
  if (orderby == 'size' && order == 'desc') return OrderBySizeDesc(list)
  if (orderby == 'updated_at' && order == 'asc') return OrderByTimeAsc(list)
  if (orderby == 'updated_at' && order == 'desc') return OrderByTimeDesc(list)
  if (orderby == 'name' && order == 'asc') return OrderByNameAsc(list)
  if (orderby == 'name' && order == 'desc') return OrderByNameDesc(list)
  return list
}

export function OrderFile(orderby: string, order: string, list: IAliGetFileModel[]) {
  orderby = orderby.toLowerCase()
  order = order.toLowerCase()
  if (orderby == 'size' && order == 'asc') return OrderBySizeAsc(list)
  if (orderby == 'size' && order == 'desc') return OrderBySizeDesc(list)
  if (orderby == 'updated_at' && order == 'asc') return OrderByTimeAsc(list)
  if (orderby == 'updated_at' && order == 'desc') return OrderByTimeDesc(list)
  if (orderby == 'name' && order == 'asc') return OrderByNameAsc(list)
  if (orderby == 'name' && order == 'desc') return OrderByNameDesc(list)
  return list
}


function OrderByTimeAsc(list: { time: number; name: string }[]) {
  let t = 0
  return list.sort(function (a, b) {
    t = a.time - b.time
    if (t == 0) return _OrderName(a.name, b.name)
    else return t
  })
}

function OrderByTimeDesc(list: { time: number; name: string }[]) {
  return list.sort(function (b, a) {
    const t = a.time - b.time
    if (t == 0) return _OrderName(a.name, b.name)
    else return t
  })
}

function OrderBySizeAsc(list: { size: number; name: string }[]) {
  return list.sort(function (a, b) {
    const t = a.size - b.size
    if (t == 0) return _OrderName(a.name, b.name)
    else return t
  })
}

function OrderBySizeDesc(list: { size: number; name: string }[]) {
  return list.sort(function (b, a) {
    const t = a.size - b.size
    if (t == 0) return _OrderName(a.name, b.name)
    else return t
  })
}

function OrderByNameAsc(list: { name: string }[]) {
  return list.sort(function (a, b) {
    return _OrderName(a.name, b.name)
  })
}

function OrderByNameDesc(list: { name: string }[]) {
  return list.sort(function (b, a) {
    return _OrderName(a.name, b.name)
  })
}

const intlcn = new Intl.Collator(['zh-CN-u-co-pinyin', 'jp', 'en'], { numeric: true })
const intlen = new Intl.Collator(['en', 'zh-CN-u-co-pinyin', 'jp'], { numeric: true })
const azreg = new RegExp('[a-zA-Z]')

function _OrderName(a: string, b: string) {
  
  a = replaceHanNumber(a)
  b = replaceHanNumber(b)
  if (azreg.test(a.charAt(0)) || azreg.test(b.charAt(0))) return intlen.compare(a, b)
  return intlcn.compare(a, b)
}

function replaceHanNumber(a: string): string {
  let b = ''
  let c = ''

  for (let i = 0, maxi = a.length; i < maxi; i++) {
    c = a[i]
    switch (c) {
      case '???':
        b += '0' 
        break
      case '???':
        b += '1'
        break
      case '???':
        b += '1'
        break
      case '???':
        b += '1'
        break
      case '???':
        b += '2'
        break
      case '???':
        b += '2'
        break
      case '???':
        b += '2'
        break
      case '???':
        b += '3'
        break
      case '???':
        b += '3'
        break
      case '???':
        b += '3'
        break
      case '???':
        b += '4'
        break
      case '???':
        b += '4'
        break
      case '???':
        b += '4'
        break
      case '???':
        b += '5'
        break
      case '???':
        b += '5'
        break
      case '???':
        b += '5'
        break
      case '???':
        b += '6'
        break
      case '???':
        b += '6'
        break
      case '???':
        b += '6'
        break
      case '???':
        b += '7'
        break
      case '???':
        b += '7'
        break
      case '???':
        b += '7'
        break
      case '???':
        b += '8'
        break
      case '???':
        b += '8'
        break
      case '???':
        b += '8'
        break
      case '???':
        b += '9'
        break
      case '???':
        b += '9'
        break
      case '???':
        b += '9'
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      case '???':
        b += ''
        break
      default:
        b += c
    }
  }
  return b
}
