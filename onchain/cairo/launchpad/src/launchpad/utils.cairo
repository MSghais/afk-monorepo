use afk_launchpad::launchpad::math::{PercentageMath, pow_256};
use afk_launchpad::utils::{sqrt};
use core::num::traits::{Zero};
use ekubo::types::bounds::Bounds;
use ekubo::types::i129::i129;


use starknet::ContractAddress;

pub const MIN_TICK: i32 = -88722883;
pub const MAX_TICK: i32 = 88722883;

pub const MIN_TICK_U128: u128 = 88722883;
pub const MAX_TICK_U128: u128 = 88722883;

// Min and max sqrt ratio values from the Rust implementation
// pub const MIN_SQRT_RATIO: u256 = 4295128739; // Simplified from 4363438787445
// pub const MAX_SQRT_RATIO: u256 = 1461446703485210103287273052203988822378723970342;

pub const MIN_SQRT_RATIO: u256 = 18446748437148339061;
pub const MAX_SQRT_RATIO: u256 = 6277100250585753475930931601400621808602321654880405518632;

// use integer::u256_from_felt252;
pub fn sort_tokens(
    tokenA: ContractAddress, tokenB: ContractAddress
) -> (ContractAddress, ContractAddress) {
    if tokenA < tokenB {
        (tokenA, tokenB)
    } else {
        (tokenB, tokenA)
    }
}

pub fn get_initial_tick_from_starting_price(
    starting_price: i129, bound_mag: u128, is_token1_quote: bool
) -> (i129, Bounds) {
    // println!("get_initial_tick_from_starting_price",);
    // println!("is_token1_quote {}", is_token1_quote);
    // println!("starting_price sign {}", starting_price.sign);
    // println!("bound_mag {}", bound_mag);

    let (initial_tick, bounds) = if is_token1_quote {
        // the price is always supplied in quote/meme. if token 1 is quote,
        // then the upper bound expressed in quote/meme is +inf
        // and the lower bound is the starting price.
        (
            i129 { sign: starting_price.sign, mag: starting_price.mag },
            Bounds {
                lower: i129 { sign: starting_price.sign, mag: starting_price.mag },
                upper: i129 { sign: false, mag: bound_mag }
            }
        )
    } else {
        // The initial tick sign is reversed if the quote is token0.
        // as the price provided was expressed in token1/token0.
        (
            i129 { sign: !starting_price.sign, mag: starting_price.mag },
            Bounds {
                lower: i129 { sign: true, mag: bound_mag },
                upper: i129 { sign: !starting_price.sign, mag: starting_price.mag }
            }
        )
    };
    (initial_tick, bounds)
}

pub fn get_initial_tick_from_starting_price_unrug(
    starting_price: i129, bound_mag: u128, is_token1_quote: bool
) -> (i129, Bounds) {
    let (initial_tick, bounds) = if is_token1_quote {
        // the price is always supplied in quote/meme. if token 1 is quote,
        // then the upper bound expressed in quote/meme is +inf
        // and the lower bound is the starting price.
        (
            i129 { sign: starting_price.sign, mag: starting_price.mag },
            Bounds {
                lower: i129 { sign: starting_price.sign, mag: starting_price.mag },
                upper: i129 { sign: false, mag: bound_mag }
            }
        )
    } else {
        // The initial tick sign is reversed if the quote is token0.
        // as the price provided was expressed in token1/token0.
        (
            i129 { sign: !starting_price.sign, mag: starting_price.mag },
            Bounds {
                lower: i129 { sign: true, mag: bound_mag },
                upper: i129 { sign: !starting_price.sign, mag: starting_price.mag }
            }
        )
    };
    (initial_tick, bounds)
}

pub fn get_next_tick_bounds(
    starting_price: i129, tick_spacing: u128, is_token1_quote: bool
) -> Bounds {
    // The sign of the next bound is the same as the sign of the starting tick.
    // If the token1 is the quote token, the price is expressed in the correct token1/token 0 order
    // and the sign of the starting tick is the same as the sign of the price.
    // otherwise, it's flipped.
    let bound_sign = if is_token1_quote {
        starting_price.sign
    } else {
        !starting_price.sign
    };

    // The magnitude of the next bound is the starting tick magnitude plus or minus the tick
    // spacing.
    // If the starting sign is negative, then the next bound is the starting tick minus the tick
    // spacing.
    // If the starting sign is positive, then the next bound is the starting tick plus the tick
    // spacing.
    let bound_mag = if starting_price.sign {
        starting_price.mag - tick_spacing
    } else {
        starting_price.mag + tick_spacing
    };

    let (lower_mag, upper_mag) = if (is_token1_quote) {
        (starting_price.mag, bound_mag)
    } else {
        (bound_mag, starting_price.mag)
    };

    Bounds {
        lower: i129 { sign: bound_sign, mag: lower_mag },
        upper: i129 { sign: bound_sign, mag: upper_mag }
    }
}

pub fn align_tick(tick: i128, tick_spacing: i128) -> i128 {
    // Calculate the remainder of the tick divided by the tick spacing
    let remainder = tick % tick_spacing;

    // If the remainder is zero, the tick is already aligned
    if remainder == 0 {
        return tick;
    }

    // Calculate the aligned tick by subtracting the remainder
    // This aligns the tick to the nearest lower multiple of tick_spacing
    let aligned_tick = tick - remainder;

    // Return the aligned tick
    return aligned_tick;
}

pub fn align_tick_with_max_tick_and_min_tick(tick: u128, tick_spacing: u128) -> u128 {
    // Calculate the remainder of the tick divided by the tick spacing
    let remainder = tick % tick_spacing;

    // If the remainder is zero, the tick is already aligned
    if remainder == 0 {
        return tick;
    }

    // Calculate the aligned tick by subtracting the remainder
    // This aligns the tick to the nearest lower multiple of tick_spacing
    let aligned_tick = tick - remainder;

    // Return the aligned tick
    return aligned_tick;
}

pub fn unique_count<T, +Copy<T>, +Drop<T>, +PartialEq<T>>(mut self: Span<T>) -> u32 {
    let mut counter = 0;
    let mut result: Array<T> = array![];
    loop {
        match self.pop_front() {
            Option::Some(value) => {
                if contains(result.span(), *value) {
                    continue;
                }
                result.append(*value);
                counter += 1;
            },
            Option::None => { break; }
        }
    };
    counter
}

pub fn sum<T, +Copy<T>, +Drop<T>, +PartialEq<T>, +Zero<T>, +AddEq<T>>(mut self: Span<T>) -> T {
    let mut result = Zero::zero();
    loop {
        match self.pop_front() {
            Option::Some(value) => { result += *value; },
            Option::None => { break; }
        }
    };
    result
}

pub fn contains<T, +Copy<T>, +Drop<T>, +PartialEq<T>>(mut self: Span<T>, value: T) -> bool {
    loop {
        match self.pop_front() {
            Option::Some(current) => { if *current == value {
                break true;
            } },
            Option::None => { break false; }
        }
    }
}

pub fn calculate_bound_mag(fee: u128, tick_spacing: u128, initial_tick: i129) -> u128 {
    // First align the bound with tick spacing
    // Instead of using match with non-sequential numbers, use if/else statements
    let aligned_bound = if fee == 1 {
        // 0.01% fee
        tick_spacing * 2000 // Smaller bound for low fee tiers
    } else if fee == 5 {
        // 0.05% fee
        tick_spacing * 4000 // Medium bound for medium fee tiers
    } else if fee == 30 {
        // 0.3% fee
        tick_spacing * 6000 // Larger bound for higher fee tiers
    } else if fee == 100 {
        // 1% fee
        tick_spacing * 8000 // Largest bound for highest fee tiers
    } else {
        // Default to medium bound
        tick_spacing * 4000
    };

    // Ensure the bound doesn't exceed MAX_TICK
    let max_bound: u128 = MAX_TICK.try_into().unwrap() - initial_tick.mag.try_into().unwrap();
    if aligned_bound > max_bound {
        max_bound
    } else {
        aligned_bound
    }
}

// pub fn calculate_bound_mag(fee: u128, tick_spacing: u128, initial_tick: i129) -> u128 {
//     // First align the bound with tick spacing
//     let aligned_bound = match fee {
//         // 0% fee
//         0 => {
//             tick_spacing * 2000  // Smaller bound for low fee tiers
//         },
//         // 0.01% fee
//         1 => {
//             tick_spacing * 2000  // Smaller bound for low fee tiers
//         },
//         // 0.05% fee
//         5 => {
//             tick_spacing * 4000  // Medium bound for medium fee tiers
//         },
//         // 0.3% fee
//         30 => {
//             tick_spacing * 6000  // Larger bound for higher fee tiers
//         },
//         // 1% fee
//         100 => {
//             tick_spacing * 8000  // Largest bound for highest fee tiers
//         },
//         _ => {
//             tick_spacing * 4000  // Default to medium bound
//         }
//     };

//     // Ensure the bound doesn't exceed MAX_TICK
//     let max_bound:u128 = MAX_TICK.try_into().unwrap() - initial_tick.mag.try_into().unwrap();
//     if aligned_bound > max_bound {
//         max_bound
//     } else {
//         aligned_bound
//     }
// }

pub fn calculate_aligned_bound_mag(
    starting_price: i129, multiplier: u128, tick_spacing: u128
) -> u128 {
    // assert!(starting_price.sign, "Starting price negative");
    // assert!(tick_spacing > 0, "Invalid tick spacing");

    // Calculate initial bound_mag proportional to starting_price
    let mut init_bound = starting_price.mag * multiplier;

    // Ensure bound doesn't exceed max tick
    if init_bound > MAX_TICK_U128 {
        init_bound = MAX_TICK_U128;
    }

    // Round down to nearest tick spacing multiple
    let aligned_bound = (init_bound / tick_spacing) * tick_spacing;

    // Ensure we have at least one tick spacing
    if aligned_bound == 0 {
        tick_spacing
    } else {
        aligned_bound
    }
}
// pub fn calculate_aligned_bound_mag(
//     starting_price: i129, multiplier: u128, tick_spacing: u128
// ) -> u128 {
//     assert!(starting_price.sign, "Starting price negative");

//     // Calculate initial bound_mag proportional to starting_price
//     let mut init_bound = starting_price.mag * multiplier;

//     // Adjust bound_mag to align with tick_spacing
//     let rem = init_bound % tick_spacing;
//     if rem == 0 {
//         init_bound
//     } else {
//         init_bound + (tick_spacing - rem)
//     }
// }

// Calculate sqrt ratio with decimals precision fixed number pow(2,96)
// calcul y / x: if token1 is quote scaled and unscaled
// Bounding space
// Aligned tick spacing
// Decimals precision
// Return sqrt_ratio
pub fn calculate_sqrt_ratio(
    liquidity_raised: u256, initial_pool_supply: u256, is_token1_quote: bool
) -> u256 {
    let scale_factor = pow_256(10, 18);
    let decimals_precision = pow_256(2, 96);

    println!("liquidity_raised {}", liquidity_raised.clone());
    println!("initial_pool_supply {}", initial_pool_supply.clone());
    println!("is_token1_quote {}", is_token1_quote.clone());
    let y_x_scaled = (liquidity_raised * scale_factor) / initial_pool_supply;
    let mut x_y = if is_token1_quote {
        // Step 1: Scale x_y by 10^18 before taking the square root.

        // (launch.liquidity_raised ) / launch.initial_pool_supply

        // (liquidity_raised * scale_factor) / initial_pool_supply
        (liquidity_raised * decimals_precision) / initial_pool_supply
        // (launch.liquidity_raised * scale_factor) / (launch.initial_pool_supply *
    // scale_factor)
    } else {
        (initial_pool_supply) / liquidity_raised
    };

    // let mut sqrt_ratio = sqrt(x_y) * pow_256(2, 96);
    let mut sqrt_ratio = sqrt(x_y) * pow_256(2, 96);
    let mut sqrt_ratio_without_decimals = sqrt(x_y);
    let mut sqrt_ratio_without_decimals_scaled = sqrt(x_y);

    println!("sqrt_ratio decimals{}", sqrt_ratio.clone());
    println!("sqrt_ratio_without_decimals {}", sqrt_ratio_without_decimals.clone());
    if is_token1_quote == true {
        sqrt_ratio = sqrt_ratio_without_decimals / sqrt(scale_factor);
        sqrt_ratio_without_decimals = sqrt_ratio_without_decimals / sqrt(scale_factor);
        println!("sqrt_ratio after scaling {}", sqrt_ratio.clone());
    }
    sqrt_ratio = sqrt_ratio_without_decimals * pow_256(2, 96);
    println!("sqrt_ratio after scaling decimals precisions {}", sqrt_ratio.clone());
    // if is_token1_quote == true {
    //     sqrt_ratio = sqrt(x_y * pow_256(2, 96)) * pow_256(2, 48);
    //     // Apply fixed-point scaling before sqrt
    //     println!("sqrt_ratio test {}", sqrt_ratio.clone());
    //     // Step 1: Scale x_y with decimals before taking sqrt
    //     let mut yx_scaled = x_y;
    //     let mut yx_scaled_decimals = x_y * pow_256(2, 96);
    //     // Compute square root

    //     // Step 2: Compute sqrt(yx_scaled)
    //     // let sqrt_ratio_scaled = sqrt(yx_scaled_decimals);
    //     let sqrt_ratio_scaled = sqrt(yx_scaled);
    //     println!("sqrt_ratio_scaled test {}", sqrt_ratio_scaled.clone());
    //     // sqrt_ratio = sqrt(y_x_scaled);
    //     // sqrt_ratio = sqrt_ratio_scaled;

    //     // unscaled

    //     // Step 3: Unscale by multiplying before dividing (to avoid truncation)
    //     sqrt_ratio = (sqrt_ratio_scaled * pow_256(2, 96)) / sqrt(scale_factor);
    //     println!("sqrt_ratio step V1 done test {}", sqrt_ratio.clone());

    //     let sqrt_ratio_unscaled = sqrt_ratio_scaled / sqrt(scale_factor);
    //     println!("sqrt_ratio_unscaled test {}", sqrt_ratio_unscaled.clone());
    //     // Calculate sqrt ratio with scaled value and 2^96 scaling factor

    //     // Scale and unscale
    //     // Unscale result correctly by dividing by sqrt(scale_factor)
    //     // sqrt_ratio = sqrt_ratio_scaled / scale_factor;
    //     println!("sqrt_ratio unscaled withtout decimals{}", sqrt_ratio.clone());

    //     // let mut sqrt_ratio_unscaled_fixed = yx * pow_256(2, 96);

    //     // Step 2: Compute sqrt(y_x_scaled).
    //     let sqrt_ratio_no_decimals = sqrt(x_y);
    //     println!("sqrt_ratio_no_decimals test {}", sqrt_ratio_no_decimals.clone());
    //     // Step 3: Unscale by sqrt(10^18) (to reverse Step 1).

    //     let sqrt_ratio_unscaled_no_decimals = sqrt_ratio_no_decimals / sqrt(scale_factor);
    //     println!("sqrt_ratio_unscaled_no_decimals test {}",
    //     sqrt_ratio_unscaled_no_decimals.clone());
    //     // Step 4: Convert to 2^96 fixed-point format for compatibility.
    //     // let mut sqrt_ratio_fixed = sqrt_ratio_unscaled * pow_256(2, 96);
    //     // let mut sqrt_ratio_fixed = sqrt_ratio_unscaled_no_decimals * pow_256(2, 96);
    //     let mut sqrt_ratio_fixed = (sqrt_ratio_unscaled_no_decimals* pow_256(2, 96))/
    //     sqrt(scale_factor);
    //     println!("sqrt_ratio_fixed STEP V2 test {}", sqrt_ratio_fixed.clone());

    //     // Rescale back to fixed-point format (2^96)
    //     // sqrt_ratio = sqrt_ratio * pow_256(2, 96);
    //     // sqrt_ratio = sqrt(y_x_scaled * pow_256(2, 96));
    //     // Unscale the result by dividing by sqrt(scale_factor)
    //     // Since we multiplied x_y by scale_factor, we need to divide sqrt by
    //     // sqrt(scale_factor)
    //     // sqrt_ratio = sqrt_ratio / sqrt(scale_factor);
    //     // sqrt_ratio = sqrt_ratio * pow_256(2, 96);
    //     println!("sqrt_ratio step 1 {}", sqrt_ratio.clone());

    //     sqrt_ratio = sqrt_ratio_fixed;

    //     println!("sqrt_ratio step 2 {}", sqrt_ratio.clone());

    // }

    // if is_token1_quote == true  {

    let min_sqrt_ratio_limit = MIN_SQRT_RATIO;
    let max_sqrt_ratio_limit = MAX_SQRT_RATIO;

    // Assert range for sqrt ratio order, magnitude and min max

    // println!("assert sqrt_ratio {}", sqrt_ratio.clone());

    sqrt_ratio =
        if sqrt_ratio < min_sqrt_ratio_limit {
            println!("sqrt_ratio < min_sqrt_ratio_limit");
            min_sqrt_ratio_limit
        } else if sqrt_ratio > max_sqrt_ratio_limit {
            println!("sqrt_ratio > max_sqrt_ratio_limit");
            max_sqrt_ratio_limit
        } else {
            println!("sqrt_ratio is between min and max");
            sqrt_ratio
        };

    sqrt_ratio
}
// pub fn calculate_sqrt_ratio_old(
//     liquidity_raised: u256, initial_pool_supply: u256, is_token1_quote: bool
// ) -> u256 {
//     let scale_factor = pow_256(10, 18);
//     let decimals_precision = pow_256(2, 96);

//     println!("liquidity_raised {}", liquidity_raised.clone());
//     println!("initial_pool_supply {}", initial_pool_supply.clone());
//     println!("is_token1_quote {}", is_token1_quote.clone());
//     let y_x_scaled = (liquidity_raised * scale_factor) / initial_pool_supply;
//     let mut x_y = if is_token1_quote {
//         // Step 1: Scale x_y by 10^18 before taking the square root.

//         // (launch.liquidity_raised ) / launch.initial_pool_supply

//         // (liquidity_raised * scale_factor) / initial_pool_supply
//         (liquidity_raised * decimals_precision) / initial_pool_supply
//         // (launch.liquidity_raised * scale_factor) / (launch.initial_pool_supply *
//     // scale_factor)
//     } else {
//         (initial_pool_supply) / liquidity_raised
//     };

//     // let mut sqrt_ratio = sqrt(x_y) * pow_256(2, 96);
//     let mut sqrt_ratio = sqrt(x_y) * pow_256(2, 96);
//     let mut sqrt_ratio_without_decimals = sqrt(x_y);
//     let mut sqrt_ratio_without_decimals_scaled = sqrt(x_y);

//     println!("sqrt_ratio decimals{}", sqrt_ratio.clone());
//     println!("sqrt_ratio_without_decimals {}", sqrt_ratio_without_decimals.clone());
//     if is_token1_quote == true {
//         sqrt_ratio = sqrt_ratio_without_decimals / sqrt(scale_factor);
//         sqrt_ratio_without_decimals = sqrt_ratio_without_decimals / sqrt(scale_factor);
//         println!("sqrt_ratio after scaling {}", sqrt_ratio.clone());
//     }
//     sqrt_ratio = sqrt_ratio_without_decimals * pow_256(2, 96);
//     println!("sqrt_ratio after scaling decimals precisions {}", sqrt_ratio.clone());
//     // if is_token1_quote == true {
//     //     sqrt_ratio = sqrt(x_y * pow_256(2, 96)) * pow_256(2, 48);
//     //     // Apply fixed-point scaling before sqrt
//     //     println!("sqrt_ratio test {}", sqrt_ratio.clone());
//     //     // Step 1: Scale x_y with decimals before taking sqrt
//     //     let mut yx_scaled = x_y;
//     //     let mut yx_scaled_decimals = x_y * pow_256(2, 96);
//     //     // Compute square root

//     //     // Step 2: Compute sqrt(yx_scaled)
//     //     // let sqrt_ratio_scaled = sqrt(yx_scaled_decimals);
//     //     let sqrt_ratio_scaled = sqrt(yx_scaled);
//     //     println!("sqrt_ratio_scaled test {}", sqrt_ratio_scaled.clone());
//     //     // sqrt_ratio = sqrt(y_x_scaled);
//     //     // sqrt_ratio = sqrt_ratio_scaled;

//     //     // unscaled

//     //     // Step 3: Unscale by multiplying before dividing (to avoid truncation)
//     //     sqrt_ratio = (sqrt_ratio_scaled * pow_256(2, 96)) / sqrt(scale_factor);
//     //     println!("sqrt_ratio step V1 done test {}", sqrt_ratio.clone());

//     //     let sqrt_ratio_unscaled = sqrt_ratio_scaled / sqrt(scale_factor);
//     //     println!("sqrt_ratio_unscaled test {}", sqrt_ratio_unscaled.clone());
//     //     // Calculate sqrt ratio with scaled value and 2^96 scaling factor

//     //     // Scale and unscale
//     //     // Unscale result correctly by dividing by sqrt(scale_factor)
//     //     // sqrt_ratio = sqrt_ratio_scaled / scale_factor;
//     //     println!("sqrt_ratio unscaled withtout decimals{}", sqrt_ratio.clone());

//     //     // let mut sqrt_ratio_unscaled_fixed = yx * pow_256(2, 96);

//     //     // Step 2: Compute sqrt(y_x_scaled).
//     //     let sqrt_ratio_no_decimals = sqrt(x_y);
//     //     println!("sqrt_ratio_no_decimals test {}", sqrt_ratio_no_decimals.clone());
//     //     // Step 3: Unscale by sqrt(10^18) (to reverse Step 1).

//     //     let sqrt_ratio_unscaled_no_decimals = sqrt_ratio_no_decimals / sqrt(scale_factor);
//     //     println!("sqrt_ratio_unscaled_no_decimals test {}",
//     //     sqrt_ratio_unscaled_no_decimals.clone());
//     //     // Step 4: Convert to 2^96 fixed-point format for compatibility.
//     //     // let mut sqrt_ratio_fixed = sqrt_ratio_unscaled * pow_256(2, 96);
//     //     // let mut sqrt_ratio_fixed = sqrt_ratio_unscaled_no_decimals * pow_256(2, 96);
//     //     let mut sqrt_ratio_fixed = (sqrt_ratio_unscaled_no_decimals* pow_256(2, 96))/
//     //     sqrt(scale_factor);
//     //     println!("sqrt_ratio_fixed STEP V2 test {}", sqrt_ratio_fixed.clone());

//     //     // Rescale back to fixed-point format (2^96)
//     //     // sqrt_ratio = sqrt_ratio * pow_256(2, 96);
//     //     // sqrt_ratio = sqrt(y_x_scaled * pow_256(2, 96));
//     //     // Unscale the result by dividing by sqrt(scale_factor)
//     //     // Since we multiplied x_y by scale_factor, we need to divide sqrt by
//     //     // sqrt(scale_factor)
//     //     // sqrt_ratio = sqrt_ratio / sqrt(scale_factor);
//     //     // sqrt_ratio = sqrt_ratio * pow_256(2, 96);
//     //     println!("sqrt_ratio step 1 {}", sqrt_ratio.clone());

//     //     sqrt_ratio = sqrt_ratio_fixed;

//     //     println!("sqrt_ratio step 2 {}", sqrt_ratio.clone());

//     // }

//     // if is_token1_quote == true  {

//     let min_sqrt_ratio_limit = MIN_SQRT_RATIO;
//     let max_sqrt_ratio_limit = MAX_SQRT_RATIO;

//     // Assert range for sqrt ratio order, magnitude and min max

//     // println!("assert sqrt_ratio {}", sqrt_ratio.clone());

//     sqrt_ratio =
//         if sqrt_ratio < min_sqrt_ratio_limit {
//             println!("sqrt_ratio < min_sqrt_ratio_limit");
//             min_sqrt_ratio_limit
//         } else if sqrt_ratio > max_sqrt_ratio_limit {
//             println!("sqrt_ratio > max_sqrt_ratio_limit");
//             max_sqrt_ratio_limit
//         } else {
//             println!("sqrt_ratio is between min and max");
//             sqrt_ratio
//         };

//     sqrt_ratio
// }


