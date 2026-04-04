use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Deserialize, Serialize)]
pub struct SubArea {
    pub area: String,
    pub sub_area: String,
    pub image: String,
    pub chests: Vec<Chest>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Chest {
    pub id: u32,
    pub respawn: bool,
    pub spawn_pct: u8,
    pub gil_pct: u8,
    pub gil_max: u32,
    pub items: Vec<String>,
    pub items_da: Option<Vec<String>>,
    pub tza_note: Option<String>,
    pub position: Option<Position>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

pub fn validate(sub_area: &SubArea) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    let mut seen_ids = HashSet::new();
    let mut duplicate_reported = false;

    for (i, chest) in sub_area.chests.iter().enumerate() {
        if chest.spawn_pct > 100 {
            errors.push(ValidationError {
                field: format!("chests[{i}].spawn_pct"),
                message: format!("must be 0–100, got {}", chest.spawn_pct),
            });
        }

        if chest.gil_pct > 100 {
            errors.push(ValidationError {
                field: format!("chests[{i}].gil_pct"),
                message: format!("must be 0–100, got {}", chest.gil_pct),
            });
        }

        let items_empty_ok = chest.gil_pct == 100;
        if (chest.items.is_empty() && !items_empty_ok) || chest.items.len() > 2 {
            errors.push(ValidationError {
                field: format!("chests[{i}].items"),
                message: format!("must have 1–2 entries, got {}", chest.items.len()),
            });
        }

        if let Some(pos) = &chest.position {
            if !(0.0..=100.0).contains(&pos.x) {
                errors.push(ValidationError {
                    field: format!("chests[{i}].position.x"),
                    message: format!("must be 0.0–100.0, got {}", pos.x),
                });
            }
            if !(0.0..=100.0).contains(&pos.y) {
                errors.push(ValidationError {
                    field: format!("chests[{i}].position.y"),
                    message: format!("must be 0.0–100.0, got {}", pos.y),
                });
            }
        }

        if !seen_ids.insert(chest.id) && !duplicate_reported {
            errors.push(ValidationError {
                field: "chests".to_string(),
                message: format!("duplicate chest id {}", chest.id),
            });
            duplicate_reported = true;
        }
    }

    errors
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_chest() -> Chest {
        Chest {
            id: 1,
            respawn: true,
            spawn_pct: 75,
            gil_pct: 50,
            gil_max: 250,
            items: vec!["Antidote".to_string()],
            items_da: None,
            tza_note: None,
            position: None,
        }
    }

    fn minimal_sub_area(chests: Vec<Chest>) -> SubArea {
        SubArea {
            area: "Test Area".to_string(),
            sub_area: "Test Sub".to_string(),
            image: "01.jpg".to_string(),
            chests,
        }
    }

    struct Case {
        name: &'static str,
        sub_area: SubArea,
        expected_fields: &'static [&'static str],
    }

    #[test]
    fn validation_cases() {
        let cases = [
            Case {
                name: "valid_minimal",
                sub_area: minimal_sub_area(vec![minimal_chest()]),
                expected_fields: &[],
            },
            Case {
                name: "valid_full",
                sub_area: minimal_sub_area(vec![Chest {
                    items_da: Some(vec!["Potion".to_string(), "Hi-Potion".to_string()]),
                    position: Some(Position { x: 45.2, y: 32.1 }),
                    ..minimal_chest()
                }]),
                expected_fields: &[],
            },
            Case {
                name: "spawn_pct_over_100",
                sub_area: minimal_sub_area(vec![Chest {
                    spawn_pct: 101,
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].spawn_pct"],
            },
            Case {
                name: "gil_pct_over_100",
                sub_area: minimal_sub_area(vec![Chest {
                    gil_pct: 101,
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].gil_pct"],
            },
            Case {
                name: "items_empty",
                sub_area: minimal_sub_area(vec![Chest {
                    items: vec![],
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].items"],
            },
            Case {
                name: "items_empty_gil_100_ok",
                sub_area: minimal_sub_area(vec![Chest {
                    gil_pct: 100,
                    items: vec![],
                    ..minimal_chest()
                }]),
                expected_fields: &[],
            },
            Case {
                name: "items_too_many",
                sub_area: minimal_sub_area(vec![Chest {
                    items: vec!["a".to_string(), "b".to_string(), "c".to_string()],
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].items"],
            },
            Case {
                name: "items_da_valid_strings",
                sub_area: minimal_sub_area(vec![Chest {
                    items_da: Some(vec![
                        "Knot of Rust".to_string(),
                        "Meteorite (B)".to_string(),
                    ]),
                    ..minimal_chest()
                }]),
                expected_fields: &[],
            },
            Case {
                name: "position_x_out_of_range",
                sub_area: minimal_sub_area(vec![Chest {
                    position: Some(Position { x: 101.0, y: 50.0 }),
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].position.x"],
            },
            Case {
                name: "position_y_out_of_range",
                sub_area: minimal_sub_area(vec![Chest {
                    position: Some(Position { x: 50.0, y: -1.0 }),
                    ..minimal_chest()
                }]),
                expected_fields: &["chests[0].position.y"],
            },
            Case {
                name: "duplicate_id",
                sub_area: minimal_sub_area(vec![
                    minimal_chest(),
                    Chest {
                        id: 1,
                        ..minimal_chest()
                    },
                ]),
                expected_fields: &["chests"],
            },
        ];

        for case in &cases {
            let errors = validate(&case.sub_area);
            let got_fields: Vec<&str> = errors.iter().map(|e| e.field.as_str()).collect();
            assert_eq!(
                got_fields, case.expected_fields,
                "case '{}': expected fields {:?}, got {:?}",
                case.name, case.expected_fields, got_fields,
            );
        }
    }
}
