import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { SorobanAdapter } from '../soroban/adapter.js'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/errorCodes.js'

const amountSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
})

function canAccessAccount(req: AuthenticatedRequest, account: string): boolean {
  // Admins can access any account
  if (req.user?.role === 'admin') {
    return true
  }
  // Users can only access their own account (using userId as account identifier)
  // For Stellar addresses, we'd need to map userId to walletAddress in the future
  return req.user?.id === account
}

export function createBalanceRouter(adapter: SorobanAdapter) {
     const router = Router()

     router.get('/balance/:account', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
          try {
               const { account } = req.params

               if (!account || account.trim() === '') {
                    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Account parameter is required')
               }

               // Authorization check: user can only access their own account unless admin
               if (!canAccessAccount(req, account)) {
                    throw new AppError(ErrorCode.FORBIDDEN, 403, 'You can only access your own account')
               }

               const balance = await adapter.getBalance(account)
               const config = adapter.getConfig()

               res.json({
                    account,
                    balance: balance.toString(),
                    contractId: config.contractId,
                    // Include stub indicator in response for clarity
                    adapter: 'stub',
                    network: config.networkPassphrase
               })
          } catch (error) {
               next(error)
          }
     })

     // Add endpoints for credit/debit operations
     router.post('/balance/:account/credit', authenticateToken, requirePermission('balance', 'modify'), validate(amountSchema, 'body'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
          try {
               const { account } = req.params
               const { amount } = req.body

               // Authorization check: user can only modify their own account unless admin
               if (!canAccessAccount(req, account)) {
                    throw new AppError(ErrorCode.FORBIDDEN, 403, 'You can only modify your own account')
               }

               const amountBigInt = BigInt(amount)
               await adapter.credit(account, amountBigInt)

               const newBalance = await adapter.getBalance(account)
               const config = adapter.getConfig()

               res.json({
                    account,
                    credited: amount,
                    newBalance: newBalance.toString(),
                    contractId: config.contractId,
                    adapter: 'stub'
               })
          } catch (error) {
               next(error)
          }
     })

     router.post('/balance/:account/debit', authenticateToken, requirePermission('balance', 'modify'), validate(amountSchema, 'body'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
          try {
               const { account } = req.params
               const { amount } = req.body

               // Authorization check: user can only modify their own account unless admin
               if (!canAccessAccount(req, account)) {
                    throw new AppError(ErrorCode.FORBIDDEN, 403, 'You can only modify your own account')
               }

               const amountBigInt = BigInt(amount)
               await adapter.debit(account, amountBigInt)

               const newBalance = await adapter.getBalance(account)
               const config = adapter.getConfig()

               res.json({
                    account,
                    debited: amount,
                    newBalance: newBalance.toString(),
                    contractId: config.contractId,
                    adapter: 'stub'
               })
          } catch (error) {
               next(error)
          }
     })

     return router
}
