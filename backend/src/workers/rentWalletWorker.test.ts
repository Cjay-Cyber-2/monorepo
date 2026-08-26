import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RentWalletWorker } from './rentWalletWorker.js'
import { outboxStore } from '../outbox/store.js'
import { OutboxStatus, TxType } from '../outbox/types.js'
import { SorobanAdapter } from '../soroban/adapter.js'

describe('RentWalletWorker', () => {
  let mockAdapter: Partial<SorobanAdapter>
  let worker: RentWalletWorker

  beforeEach(async () => {
    await outboxStore.clear()
    mockAdapter = {
      rentWalletCredit: vi.fn().mockResolvedValue('tx_hash_123'),
      rentWalletDebit: vi.fn().mockResolvedValue('tx_hash_456'),
    }
    worker = new RentWalletWorker(mockAdapter as SorobanAdapter)
  })

  afterEach(async () => {
    await worker.stop()
    await outboxStore.clear()
  })

  describe('process', () => {
    it('should process a pending rent wallet credit item', async () => {
      await outboxStore.create({
        txType: TxType.RENT_WALLET_CREDIT,
        source: 'ngn_wallet',
        ref: 'deposit-123',
        payload: {
          account: 'user_123',
          amount: '1000000',
          userId: 'user-123',
        },
      })

      await worker.process()

      expect(mockAdapter.rentWalletCredit).toHaveBeenCalledWith('user_123', BigInt(1000000))
      const items = await outboxStore.listByStatus(OutboxStatus.PENDING)
      expect(items).toHaveLength(0)
    })

    it('should process a pending rent wallet debit item', async () => {
      await outboxStore.create({
        txType: TxType.RENT_WALLET_DEBIT,
        source: 'ngn_wallet',
        ref: 'withdrawal-123',
        payload: {
          account: 'user_123',
          amount: '500000',
          userId: 'user-123',
        },
      })

      await worker.process()

      expect(mockAdapter.rentWalletDebit).toHaveBeenCalledWith('user_123', BigInt(500000))
      const items = await outboxStore.listByStatus(OutboxStatus.PENDING)
      expect(items).toHaveLength(0)
    })

    it('should skip items with different tx types', async () => {
      await outboxStore.create({
        txType: TxType.RECEIPT,
        source: 'test',
        ref: 'test-123',
        payload: {},
      })

      await worker.process()

      expect(mockAdapter.rentWalletCredit).not.toHaveBeenCalled()
      expect(mockAdapter.rentWalletDebit).not.toHaveBeenCalled()
    })

    it('should mark item as failed on adapter error', async () => {
      mockAdapter.rentWalletCredit = vi.fn().mockRejectedValue(new Error('Contract error'))

      await outboxStore.create({
        txType: TxType.RENT_WALLET_CREDIT,
        source: 'ngn_wallet',
        ref: 'deposit-123',
        payload: {
          account: 'user_123',
          amount: '1000000',
          userId: 'user-123',
        },
      })

      await worker.process()

      const failed = await outboxStore.listByStatus(OutboxStatus.FAILED)
      expect(failed).toHaveLength(1)
      expect(failed[0].lastError).toBe('Contract error')
    })

    it('should mark item as dead if missing required payload fields', async () => {
      await outboxStore.create({
        txType: TxType.RENT_WALLET_CREDIT,
        source: 'ngn_wallet',
        ref: 'deposit-123',
        payload: {
          account: 'user_123',
          // Missing amount
        },
      })

      await worker.process()

      const dead = await outboxStore.listByStatus(OutboxStatus.DEAD)
      expect(dead).toHaveLength(1)
      expect(dead[0].lastError).toContain('Missing account or amount')
    })

    it('should retry failed items within retry limit', async () => {
      mockAdapter.rentWalletCredit = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('tx_hash_123')

      await outboxStore.create({
        txType: TxType.RENT_WALLET_CREDIT,
        source: 'ngn_wallet',
        ref: 'deposit-123',
        payload: {
          account: 'user_123',
          amount: '1000000',
          userId: 'user-123',
        },
      })

      // First attempt - should fail
      await worker.process()
      let failed = await outboxStore.listByStatus(OutboxStatus.FAILED)
      expect(failed).toHaveLength(1)
      expect(failed[0].retryCount).toBe(0)

      // Second attempt - should succeed
      await worker.process()
      const pending = await outboxStore.listByStatus(OutboxStatus.PENDING)
      expect(pending).toHaveLength(0)
    })

    it('should mark item as dead after max retries', async () => {
      mockAdapter.rentWalletCredit = vi.fn().mockRejectedValue(new Error('Persistent error'))

      await outboxStore.create({
        txType: TxType.RENT_WALLET_CREDIT,
        source: 'ngn_wallet',
        ref: 'deposit-123',
        payload: {
          account: 'user_123',
          amount: '1000000',
          userId: 'user-123',
        },
      })

      // Process 6 times to exceed max retries (MAX_RENT_WALLET_RETRIES = 5)
      for (let i = 0; i < 6; i++) {
        await worker.process()
      }

      const dead = await outboxStore.listByStatus(OutboxStatus.DEAD)
      expect(dead).toHaveLength(1)
      expect(dead[0].lastError).toContain('Max rent wallet sync retry count reached')
    })
  })

  describe('start/stop', () => {
    it('should start and stop the worker', async () => {
      const startSpy = vi.spyOn(worker as any, 'process').mockResolvedValue(undefined)
      
      worker.start(100) // Fast interval for testing
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(startSpy).toHaveBeenCalled()
      
      await worker.stop()
      
      await new Promise(resolve => setTimeout(resolve, 150))
      const callCountAfterStop = startSpy.mock.calls.length
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Should not have called again after stop
      expect(startSpy.mock.calls.length).toBe(callCountAfterStop)
    })
  })
})
