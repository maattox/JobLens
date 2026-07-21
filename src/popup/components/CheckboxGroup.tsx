import { toggleCheckboxGroup } from "../../shared/checkboxGroup";

interface CheckboxOption<T extends string> {
  value: T;
  label: string;
}

interface CheckboxGroupProps<T extends string> {
  legend: string;
  options: CheckboxOption<T>[];
  selected: T[];
  noPreference: T;
  onChange: (next: T[]) => void;
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  selected,
  noPreference,
  onChange,
}: CheckboxGroupProps<T>) {
  return (
    <fieldset className="checkbox-group">
      <legend className="field-heading">{legend}</legend>
      <div className="checkbox-options">
        {options.map((option) => {
          const id = `${legend}-${option.value}`;
          return (
            <label key={option.value} htmlFor={id} className="checkbox-option">
              <input
                id={id}
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() =>
                  onChange(toggleCheckboxGroup(selected, option.value, noPreference))
                }
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
