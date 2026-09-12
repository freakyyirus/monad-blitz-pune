use anchor_lang::prelude::*;

declare_id!("4bEizfTQRQDRVptCzft1kAPvRprrzk3VJunj15ZYemjg");

#[program]
pub mod monquest_counter {
    use super::*;

    /// Initializes the counter with a fixed authority and count = 0.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.authority.key();
        counter.count = 0;
        Ok(())
    }

    /// Increments the counter. Only the stored authority may call this.
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).expect("counter overflow");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8,
        seeds = [b"counter"],
        bump
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(
        mut,
        seeds = [b"counter"],
        bump,
        has_one = authority @ ErrorCode::UnauthorizedAuthority
    )]
    pub counter: Account<'info, Counter>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Counter {
    /// Account that is allowed to increment the counter.
    pub authority: Pubkey,
    /// Current value of the counter.
    pub count: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the counter authority may increment")]
    UnauthorizedAuthority,
}