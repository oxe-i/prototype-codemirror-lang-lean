// The single source of truth for Lean's curated built-in type names, used
// by the Std.<Type> external tokenizers (see std-namespace.ts). Kept in
// sync with the TypeName rule in syntax.grammar by hand, the same way
// qualifiedTypeStart already is — see the comment there.
export const TYPE_NAMES: ReadonlySet<string> = new Set([
  "Add", "And", "Array", "BEq", "BitVec", "Bool", "ByteArray", "Char",
  "Decidable", "DecidableEq", "DHashMap", "Div", "DTreeMap", "Empty", "Eq",
  "Except", "ExceptT", "Expr", "ExtDHashMap", "ExtHashMap", "ExtHashSet",
  "False", "Fin", "Float", "Float32", "FloatArray", "Format", "GE", "GT",
  "HEq", "HashMap", "HashSet", "Hashable", "IO", "Id", "Iff", "Inhabited",
  "Int", "Int8", "Int16", "Int32", "Int64", "LE", "LT", "LawfulBEq", "List",
  "MProd", "Mod", "Mul", "Nat", "Ne", "Neg", "Nonempty", "Not", "Option",
  "OptionT", "Or", "Ord", "Ordering", "PEmpty", "PLift", "PProd", "PSigma",
  "PSum", "PUnit", "Pow", "Prod", "Quot", "Quotient", "Range", "ReaderM",
  "ReaderT", "Repr", "Sigma", "ST", "StateM", "StateT", "String", "Sub",
  "Subarray", "Subtype", "Sum", "Syntax", "Task", "Thunk", "ToString",
  "TreeMap", "TreeSet", "True", "UInt8", "UInt16", "UInt32", "UInt64",
  "ULift", "USize", "Unit", "Vector",
]);
