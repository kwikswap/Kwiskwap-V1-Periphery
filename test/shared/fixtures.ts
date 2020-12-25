import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import KwikswapV1Factory from '@kwikswap/v1-core/build/KwikswapV1Factory.json'
import IKwikswapV1Pair from '@kwikswap/v1-core/build/IKwikswapV1Pair.json'

import ERC20 from '../../build/ERC20.json'
import WETH9 from '../../build/WETH9.json'
import KwikswapVExchange from '../../build/KwikswapVExchange.json'
import KwikswapVFactory from '../../build/KwikswapVFactory.json'
import KwikswapV1Router01 from '../../build/KwikswapV1Router01.json'
import KwikswapV1Migrator from '../../build/KwikswapV1Migrator.json'
import KwikswapV1Router02 from '../../build/KwikswapV1Router02.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'

const overrides = {
  gasLimit: 9999999
}

interface V1Fixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryV: Contract
  factoryV1: Contract
  router01: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  migrator: Contract
  WETHExchangeV: Contract
  pair: Contract
  WETHPair: Contract
}

export async function v1Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V1Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy V
  const factoryV = await deployContract(wallet, KwikswapVFactory, [])
  await factoryV.initializeFactory((await deployContract(wallet, KwikswapVExchange, [])).address)

  // deploy V1
  const factoryV1 = await deployContract(wallet, KwikswapV1Factory, [wallet.address])

  // deploy routers
  const router01 = await deployContract(wallet, KwikswapV1Router01, [factoryV1.address, WETH.address], overrides)
  const router02 = await deployContract(wallet, KwikswapV1Router02, [factoryV1.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // deploy migrator
  const migrator = await deployContract(wallet, KwikswapV1Migrator, [factoryV.address, router01.address], overrides)

  // initialize V
  await factoryV.createExchange(WETHPartner.address, overrides)
  const WETHExchangeVAddress = await factoryV.getExchange(WETHPartner.address)
  const WETHExchangeV = new Contract(WETHExchangeVAddress, JSON.stringify(KwikswapVExchange.abi), provider).connect(
    wallet
  )

  // initialize V1
  await factoryV1.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV1.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IKwikswapV1Pair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV1.createPair(WETH.address, WETHPartner.address)
  const WETHPairAddress = await factoryV1.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IKwikswapV1Pair.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV,
    factoryV1,
    router01,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    migrator,
    WETHExchangeV,
    pair,
    WETHPair
  }
}
