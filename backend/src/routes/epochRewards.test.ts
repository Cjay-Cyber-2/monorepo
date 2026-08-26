import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createEpochRewardsRouter } from './epochRewards.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { SorobanAdapter } from '../soroban/adapter.js'

describe('epochRewards routes', () => {
  let app: express.Application
  let mockSorobanAdapter: Partial<SorobanAdapter>

  beforeEach(() => {
    app = express()
    app.use(express.json())

    mockSorobanAdapter = {
      epochStake: vi.fn().mockResolvedValue('tx_hash_123'),
      epochUnstake: vi.fn().mockResolvedValue('tx_hash_456'),
      epochClaim: vi.fn().mockResolvedValue(BigInt(1000)),
      epochGetClaimable: vi.fn().mockResolvedValue(BigInt(500)),
      epochGetEpoch: vi.fn().mockResolvedValue({
        epoch_number: 1,
        start_ts: 1000,
        duration_secs: 86400,
        end_ts: 87400,
        seal_ts: 87400,
        sealed: true,
        total_rewards: BigInt(10000),
        carried_forward: BigInt(0),
        reward_index_at_seal: BigInt(1000),
        dust: BigInt(0),
        total_claimable_at_seal: BigInt(5000),
      }),
      epochGetCurrentEpoch: vi.fn().mockResolvedValue(1),
      epochGetTotalStaked: vi.fn().mockResolvedValue(BigInt(1000000)),
    }

    // Mock the auth middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'tenant',
        walletAddress: 'GTEST123456789',
      }
      next()
    })

    // Mock the soroban adapter
    vi.mock('../soroban/index.js', () => ({
      createSorobanAdapter: vi.fn(() => mockSorobanAdapter),
      getSorobanConfigFromEnv: vi.fn(() => ({})),
    }))

    app.use('/api/epoch-rewards', createEpochRewardsRouter())
  })

  describe('POST /stake', () => {
    it('should stake successfully with valid amount', async () => {
      const response = await request(app)
        .post('/api/epoch-rewards/stake')
        .send({ amount: '1000000' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        txHash: 'tx_hash_123',
      })
      expect(mockSorobanAdapter.epochStake).toHaveBeenCalledWith(
        'GTEST123456789',
        BigInt(1000000),
      )
    })

    it('should return 400 if amount is missing', async () => {
      const response = await request(app).post('/api/epoch-rewards/stake').send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if amount is not positive', async () => {
      const response = await request(app)
        .post('/api/epoch-rewards/stake')
        .send({ amount: '0' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if user has no wallet address', async () => {
      app.use((req, res, next) => {
        req.user = {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'tenant',
        }
        next()
      })

      const response = await request(app)
        .post('/api/epoch-rewards/stake')
        .send({ amount: '1000000' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /unstake', () => {
    it('should unstake successfully with valid amount', async () => {
      const response = await request(app)
        .post('/api/epoch-rewards/unstake')
        .send({ amount: '500000' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        txHash: 'tx_hash_456',
      })
      expect(mockSorobanAdapter.epochUnstake).toHaveBeenCalledWith(
        'GTEST123456789',
        BigInt(500000),
      )
    })

    it('should return 400 if amount is missing', async () => {
      const response = await request(app).post('/api/epoch-rewards/unstake').send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /claim', () => {
    it('should claim rewards successfully', async () => {
      const response = await request(app).post('/api/epoch-rewards/claim')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        claimedAmount: '1000',
      })
      expect(mockSorobanAdapter.epochClaim).toHaveBeenCalledWith('GTEST123456789')
    })
  })

  describe('GET /claimable', () => {
    it('should get claimable amount successfully', async () => {
      const response = await request(app).get('/api/epoch-rewards/claimable')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        claimable: '500',
      })
      expect(mockSorobanAdapter.epochGetClaimable).toHaveBeenCalledWith(
        'GTEST123456789',
      )
    })
  })

  describe('GET /epoch/:epochNumber', () => {
    it('should get epoch info successfully', async () => {
      const response = await request(app).get('/api/epoch-rewards/epoch/1')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.epoch_number).toBe(1)
      expect(mockSorobanAdapter.epochGetEpoch).toHaveBeenCalledWith(1)
    })

    it('should return 400 for invalid epoch number', async () => {
      const response = await request(app).get('/api/epoch-rewards/epoch/invalid')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for epoch number less than 1', async () => {
      const response = await request(app).get('/api/epoch-rewards/epoch/0')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 404 if epoch not found', async () => {
      mockSorobanAdapter.epochGetEpoch = vi.fn().mockResolvedValue(null)

      const response = await request(app).get('/api/epoch-rewards/epoch/999')

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('GET /current-epoch', () => {
    it('should get current epoch number successfully', async () => {
      const response = await request(app).get('/api/epoch-rewards/current-epoch')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        currentEpoch: 1,
      })
      expect(mockSorobanAdapter.epochGetCurrentEpoch).toHaveBeenCalled()
    })
  })

  describe('GET /total-staked', () => {
    it('should get total staked amount successfully', async () => {
      const response = await request(app).get('/api/epoch-rewards/total-staked')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        totalStaked: '1000000',
      })
      expect(mockSorobanAdapter.epochGetTotalStaked).toHaveBeenCalled()
    })
  })
})
