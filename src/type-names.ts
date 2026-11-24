// The single source of truth for Lean's curated built-in type names, used
// by the Std.<Type> external tokenizers (see std-namespace.ts). Kept in
// sync with the TypeName rule in syntax.grammar by hand, the same way
// qualifiedTypeStart already is — see the comment there.
export const TYPE_NAMES: ReadonlySet<string> = new Set([
  "Add", "And", "Array", "BEq", "BitVec", "Bool", "ByteArray", "Char",
  "Decidable", "DecidableEq", "DecidableRel", "DHashMap", "Div", "DTreeMap",
  "Empty", "Eq", "Except", "ExceptT", "Expr", "ExtDHashMap", "ExtHashMap",
  "ExtHashSet", "False", "Fin", "Float", "Float32", "FloatArray", "Format",
  "GE", "GT", "HAppend", "HEq", "HashMap", "HashSet", "Hashable", "IO", "Id",
  "Iff", "Inhabited", "Int", "Int8", "Int16", "Int32", "Int64", "LE", "LT",
  "LawfulBEq", "List", "MacroM", "MProd", "Mod", "Mul", "Mutex", "Nat", "Ne",
  "Neg", "Nonempty", "Not", "Option", "OptionT", "Or", "Ord", "Ordering",
  "PEmpty", "PlainDate", "PlainDateTime", "PlainTime", "PLift", "PProd",
  "PSigma", "PSum", "PUnit", "Pow", "Prod", "Quot", "Quotient", "Range",
  "ReaderM", "ReaderT", "Ref", "Repr", "Sigma", "ST", "StateM", "StateT",
  "String", "Sub", "Subarray", "Subtype", "Sum", "Syntax", "Task", "Thunk",
  "ToString", "TreeMap", "TreeSet", "True", "TSyntax", "UInt8", "UInt16",
  "UInt32", "UInt64", "ULift", "USize", "Unit", "Vector",
]);

// Types that live in a namespace under `Std`, such as
// `Std.Time.PlainDateTime`, keyed by that namespace. Apart from the three
// `Plain…` types, which are also in the list above, they are recognised
// only after "Std.<namespace>." (see std-namespace.ts): a bare `Duration`
// or `Timestamp` stays plain, because exercises define their own types
// with names like these. The names are the date, time and duration types
// listed in the module documentation of Lean's `Std.Time`.
export const STD_NAMESPACE_TYPES: ReadonlyMap<string, ReadonlySet<string>> =
  new Map([
    [
      "Time",
      new Set([
        "DateTime", "Duration", "PlainDate", "PlainDateTime", "PlainTime",
        "TimeZone", "Timestamp", "WallTime", "Weekday", "ZonedDateTime",
      ]),
    ],
  ]);
