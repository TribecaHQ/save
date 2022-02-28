//! Macros

/// Generates the signer seeds for a [crate::SAVE].
#[macro_export]
macro_rules! save_seeds {
    ($save: expr) => {
        &[&[b"SAVE" as &[u8], &$save.mint.to_bytes(), &[$save.bump]]]
    };
}
