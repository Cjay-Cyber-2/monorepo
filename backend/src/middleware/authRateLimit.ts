import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'
import { slidingWindowLimiter } from '../services/SlidingWindowLimiter.js'
import { logger } from '../utils/logger.js'

export function otpRequestRateLimit(options?: {
  windowMs?: number
  maxPerEmail?: number
  maxPerIp?: number
}) {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000
  const maxPerEmail = options?.maxPerEmail ?? 100
  const maxPerIp = options?.maxPerIp ?? 100

  return async (req: Request, _res: Response, next: NextFunction) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const ip = req.ip

    if (email) {
      const key = `auth:otp:email:${email.toLowerCase()}`
      try {
        const result = await slidingWindowLimiter.checkLimit(key, maxPerEmail, windowMs)
        if (!result.allowed) {
          return next(
            new AppError(
              ErrorCode.TOO_MANY_REQUESTS,
              429,
              'Too many OTP requests for this email. Please try again later.',
            ),
          )
        }
      } catch (error) {
        logger.warn('[authRateLimit] Redis error for OTP email rate limit, failing open', { error: String(error), key })
      }
    }

    if (ip) {
      const key = `auth:otp:ip:${ip}`
      try {
        const result = await slidingWindowLimiter.checkLimit(key, maxPerIp, windowMs)
        if (!result.allowed) {
          return next(
            new AppError(
              ErrorCode.TOO_MANY_REQUESTS,
              429,
              'Too many OTP requests from this IP. Please try again later.',
            ),
          )
        }
      } catch (error) {
        logger.warn('[authRateLimit] Redis error for OTP IP rate limit, failing open', { error: String(error), key })
      }
    }

    next()
  }
}

export function walletAuthRateLimit(options?: {
  windowMs?: number
  maxPerAddress?: number
  maxPerIp?: number
}) {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000
  const maxPerAddress = options?.maxPerAddress ?? 20
  const maxPerIp = options?.maxPerIp ?? 50

  return async (req: Request, _res: Response, next: NextFunction) => {
    const address = typeof req.body?.address === 'string' ? req.body.address : ''
    const ip = req.ip

    if (address) {
      const key = `auth:wallet:address:${address.toLowerCase()}`
      try {
        const result = await slidingWindowLimiter.checkLimit(key, maxPerAddress, windowMs)
        if (!result.allowed) {
          return next(
            new AppError(
              ErrorCode.TOO_MANY_REQUESTS,
              429,
              'Too many requests for this wallet. Please try again later.',
            ),
          )
        }
      } catch (error) {
        logger.warn('[authRateLimit] Redis error for wallet address rate limit, failing open', { error: String(error), key })
      }
    }

    if (ip) {
      const key = `auth:wallet:ip:${ip}`
      try {
        const result = await slidingWindowLimiter.checkLimit(key, maxPerIp, windowMs)
        if (!result.allowed) {
          return next(
            new AppError(
              ErrorCode.TOO_MANY_REQUESTS,
              429,
              'Too many requests from this IP. Please try again later.',
            ),
          )
        }
      } catch (error) {
        logger.warn('[authRateLimit] Redis error for wallet IP rate limit, failing open', { error: String(error), key })
      }
    }

    next()
  }
}

export function _testOnly_clearAuthRateLimits() {
  slidingWindowLimiter.clear()
}
