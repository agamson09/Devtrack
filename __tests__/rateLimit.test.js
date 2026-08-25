const { createRateLimit } = require('@/lib/rateLimit')

describe('Rate Limiting', () => {
  let rateLimit

  beforeEach(() => {
    rateLimit = createRateLimit({ windowMs: 1000, max: 3 })
  })

  it('should allow requests under the limit', () => {
    const mockRes = { setHeader: jest.fn() }
    const result1 = rateLimit('127.0.0.1', 'test', mockRes)
    expect(result1.allowed).toBe(true)
    expect(result1.remaining).toBe(2)

    const result2 = rateLimit('127.0.0.1', 'test', mockRes)
    expect(result2.allowed).toBe(true)
    expect(result2.remaining).toBe(1)
  })

  it('should block requests over the limit', () => {
    const mockRes = { setHeader: jest.fn() }
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)
    const result = rateLimit('127.0.0.1', 'test', mockRes)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('should track different IPs separately', () => {
    const mockRes = { setHeader: jest.fn() }
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)

    const result = rateLimit('192.168.1.1', 'test', mockRes)
    expect(result.allowed).toBe(true)
  })

  it('should track different endpoints separately', () => {
    const mockRes = { setHeader: jest.fn() }
    rateLimit('127.0.0.1', 'endpoint1', mockRes)
    rateLimit('127.0.0.1', 'endpoint1', mockRes)
    rateLimit('127.0.0.1', 'endpoint1', mockRes)

    const result = rateLimit('127.0.0.1', 'endpoint2', mockRes)
    expect(result.allowed).toBe(true)
  })

  it('should set correct headers', () => {
    const mockRes = { setHeader: jest.fn() }
    const rl = createRateLimit({ windowMs: 1000, max: 3 })
    const result = rl('10.0.0.1', 'headers-test', mockRes)

    expect(result.allowed).toBe(true)
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 3)
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number))
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number))
  })

  it('should set Retry-After header when blocked', () => {
    const mockRes = { setHeader: jest.fn() }
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)
    rateLimit('127.0.0.1', 'test', mockRes)

    expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number))
  })
})
