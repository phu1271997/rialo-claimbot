import type { ContractTransactionReceipt, ContractTransactionResponse, Wallet } from 'ethers';
import { logger } from './logger.js';

/**
 * Serialises every transaction sent from the oracle wallet and assigns nonces
 * explicitly.
 *
 * Two claims can be in the pipeline at once, and both write status updates from
 * the same key. Letting ethers derive the nonce per call makes the second send
 * reuse the first's nonce ("nonce too low") because the pending count has not
 * caught up yet. One queue, one counter, no collisions.
 */
class OracleTxQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private nextNonce: number | null = null;

  constructor(private readonly wallet: Wallet) {}

  /** Resets the local counter so the next send re-reads the chain. */
  invalidate(): void {
    this.nextNonce = null;
  }

  async send(
    label: string,
    build: (nonce: number) => Promise<ContractTransactionResponse>,
  ): Promise<ContractTransactionReceipt | null> {
    const run = this.tail.then(
      () => this.execute(label, build),
      () => this.execute(label, build),
    );
    // Keep the chain alive even when a link rejects.
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async execute(
    label: string,
    build: (nonce: number) => Promise<ContractTransactionResponse>,
  ): Promise<ContractTransactionReceipt | null> {
    if (this.nextNonce === null) {
      this.nextNonce = await this.wallet.getNonce('pending');
      logger.debug({ label, nonce: this.nextNonce }, 'txQueue: synced nonce from chain');
    }

    const nonce = this.nextNonce;
    try {
      const tx = await build(nonce);
      this.nextNonce = nonce + 1;
      logger.debug({ label, nonce, txHash: tx.hash }, 'txQueue: sent');
      return await tx.wait();
    } catch (err) {
      // A rejected send may or may not have consumed the nonce; re-sync rather than guess.
      this.invalidate();
      logger.warn({ label, nonce, err: String(err) }, 'txQueue: send failed, nonce invalidated');
      throw err;
    }
  }
}

let queue: OracleTxQueue | null = null;

export function oracleTxQueue(wallet: Wallet): OracleTxQueue {
  queue ??= new OracleTxQueue(wallet);
  return queue;
}
