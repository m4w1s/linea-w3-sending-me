import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import PQueue from 'p-queue';
import chalk from 'chalk';
import config from './data/config.js';

const CONTRACT_ABI = JSON.parse('[{"inputs":[],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}, {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]');
const CONTRACT_ADDRESS = '0xEaea2Fa0dea2D1191a584CFBB227220822E29086';

const rpcProvider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallets = readWallets();
const queue = new PQueue({ concurrency: config.concurrency });
const stats = {
  minted: 0,
  alreadyOwned: 0,
  total: wallets.length,
};
const startTime = Date.now();

start();
function start() {
  if (!wallets.length) {
    console.log(chalk.red('Загружено 0 кошельков!'));

    return;
  }

  console.log(chalk.blueBright(`Загружено ${wallets.length} кошельков. Начинаем работу...`));

  if (config.shuffleWallets) {
    wallets.sort(() => 0.5 - Math.random());
  }

  const intervalId = setInterval(() => {
    console.log();
    console.log(chalk.blueBright(`Осталось кошельков: ${queue.size}`));
  }, 60_000);

  filterUsedWallets(wallets)
    .then(() => {
      return queue.addAll(wallets.map((wallet) => processWallet.bind(null, wallet)));
    })
    .then(() => {
      console.log();
      console.log(chalk.bgGreen(`
Работа завершена!
${stats.minted + stats.alreadyOwned}/${stats.total} кошельков имеют NFT
Время выполнения: ${Math.round((Date.now() - startTime) / 60_000)} мин.
      `.trim()));
    })
    .finally(() => {
      clearInterval(intervalId);
    });
}

/**
 * @param {ethers.Wallet} wallet
 */
async function processWallet(wallet) {
  wallet = wallet.connect(rpcProvider);

  const delaySeconds = getRandomInt(config.delay.min, config.delay.max);

  console.log();
  console.log(localeTime(), chalk.yellow(`[${wallet.address}] Ждем ${delaySeconds} сек.`));

  await sleep(delaySeconds * 1000);

  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const ownedNftCount = await contract.balanceOf.staticCall(wallet.address);

    if (ownedNftCount) {
      stats.alreadyOwned++;

      console.log();
      console.log(localeTime(), chalk.gray(`[${wallet.address}] Уже имеет NFT`));

      return;
    }

    const transaction = await contract.mint();

    console.log();
    console.log(localeTime(), chalk.greenBright(`[${wallet.address}] Минтим NFT...`));
    console.log(chalk.gray(`Hash: ${transaction.hash}`));

    await transaction.wait(1, 150_000);

    stats.minted++;

    console.log();
    console.log(localeTime(), chalk.green(`[${wallet.address}] NFT успешно получен!`));
  } catch (e) {
    console.log();
    console.error(localeTime(), chalk.red(`[${wallet.address}] ${e.message}`));
  }
}

/**
 * @param {ethers.Wallet[]} wallets
 */
async function filterUsedWallets(wallets) {
  const title = chalk.blueBright('Фильтруем кошельки что уже имеют NFT...');

  process.stdout.write(title);

  for (let i = wallets.length - 1; i >= 0; i--) {
    const wallet = wallets[i].connect(rpcProvider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    try {
      const ownedNftCount = await contract.balanceOf.staticCall(wallet.address);

      if (ownedNftCount) {
        wallets.splice(i, 1);
      }
    } catch (e) {
      // Игнорируем
    } finally {
      const progress = Math.round((1 - (i + 1) / stats.total) * 100);

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(title + chalk.blueBright(`${progress}%`));
    }
  }

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(title + chalk.blueBright('100%') + '\n');

  const deletedCount = stats.total - wallets.length;

  if (deletedCount) {
    console.log(chalk.blueBright(`${deletedCount} кошельков уже имеют NFT. Пропускаем их`));
  }
}

function readWallets() {
  const wallets = readFileSync(new URL('./data/wallets.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(isNonEmptyLine);

  return wallets.map((wallet) => {
    const [privateKey] = wallet.trim().split(':');

    return new ethers.Wallet(privateKey);
  });

  function isNonEmptyLine(line) {
    line = line.trim();

    return line && !line.startsWith('#');
  }
}

function localeTime() {
  return new Date().toLocaleTimeString();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
