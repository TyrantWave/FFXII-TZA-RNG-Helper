const N: usize = 624;

#[derive(Debug)]
pub struct RNG {
    // array for the state vector
    mt: [u32; N],
    // mti == N+1 means mt isn't initialised
    mti: usize,
    // position in the RNG
    pub position: u32,
    pub seed: u32, // seed of this instance
}

impl RNG {
    pub const DEFAULT_SEED: u32 = 4537;

    const N: usize = 624;
    const M: usize = 397;
    const MATRIX_A: u32 = 0x9908_b0df; // constant vector a
    const UPPER_MASK: u32 = 0x8000_0000; // most significant w-r bits
    const LOWER_MASK: u32 = 0x7fff_ffff; // least significant r bits

    pub fn new() -> RNG {
        RNG::sgenrand(RNG::DEFAULT_SEED)
    }

    pub fn from(seed: u32) -> RNG {
        RNG::sgenrand(seed)
    }

    /// Initialise an RNG (mt[N]) with a given seed
    fn sgenrand(seed: u32) -> RNG {
        let mut mt = [0u32; RNG::N];
        mt[0] = seed;
        let mut mti = 1;
        while mti < RNG::N {
            let operand = mt[mti - 1] ^ (mt[mti - 1] >> 30);
            let mut val = 1_812_433_253u32
                .wrapping_mul(operand)
                .wrapping_add(mti as u32);
            val &= 0xffff_ffff;
            mt[mti] = val;
            mti += 1;
        }

        RNG {
            mt,
            mti,
            position: 0,
            seed,
        }
    }

    // Branchless equivalent of MAG_01[y & 1]: produces 0 or MATRIX_A.
    #[inline(always)]
    fn mag(y: u32) -> u32 {
        (y & 1).wrapping_neg() & RNG::MATRIX_A
    }

    #[cold]
    #[inline(never)]
    fn twist(&mut self) {
        let mut y;
        let mut kk = 0;
        while kk < (RNG::N - RNG::M) {
            y = (self.mt[kk] & RNG::UPPER_MASK) | (self.mt[kk + 1] & RNG::LOWER_MASK);
            self.mt[kk] = self.mt[kk + RNG::M] ^ (y >> 1) ^ RNG::mag(y);
            kk += 1;
        }
        while kk < (RNG::N - 1) {
            y = (self.mt[kk] & RNG::UPPER_MASK) | (self.mt[kk + 1] & RNG::LOWER_MASK);
            self.mt[kk] = self.mt[kk - (RNG::N - RNG::M)] ^ (y >> 1) ^ RNG::mag(y);
            kk += 1;
        }
        y = (self.mt[RNG::N - 1] & RNG::UPPER_MASK) | (self.mt[0] & RNG::LOWER_MASK);
        self.mt[RNG::N - 1] = self.mt[RNG::M - 1] ^ (y >> 1) ^ RNG::mag(y);
        self.mti = 0;
    }

    pub fn gen_rand(&mut self) -> u32 {
        let mut y;

        if self.mti >= RNG::N {
            self.twist();
        }

        y = self.mt[self.mti];
        self.mti += 1;

        /* Tempering */
        y ^= y >> 11;
        y ^= (y << 7) & 0x9d2c_5680;
        y ^= (y << 15) & 0xefc6_0000;
        y ^= y >> 18;

        self.position += 1;
        y
    }
}

impl Default for RNG {
    fn default() -> Self {
        RNG::new()
    }
}
