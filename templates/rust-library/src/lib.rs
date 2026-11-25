//! A small reusable greeting API.

/// Return a greeting, defaulting blank names to "world".
///
/// ```
/// assert_eq!(greeting::greet("Ada"), "Hello, Ada!");
/// ```
pub fn greet(name: &str) -> String {
    let name = name.trim();
    format!("Hello, {}!", if name.is_empty() { "world" } else { name })
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greets_a_named_person() {
        assert_eq!(greet("Ada"), "Hello, Ada!");
    }

    #[test]
    fn defaults_blank_names() {
        assert_eq!(greet("  "), "Hello, world!");
    }
}
