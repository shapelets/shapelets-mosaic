import {clausePoint, isParam, isSelection, MosaicClient, Param} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import {input} from './input.js';
import * as React from "react";
import ReactDOM from 'react-dom/client';
import {Select as AntSelect, Space, Typography} from 'antd';

const isObject = v => {
    return v && typeof v === 'object' && !Array.isArray(v);
};

export const menu = options => input(Menu, options);

const ShapeletsSelect = ({label, options, value, onAction}) => {
    const [componentValue, setComponentValue] = React.useState(value);

    const handleChange = (selectedValue) => {
        onAction(selectedValue);
        setComponentValue(selectedValue)
    };

    return (
        <Space direction="vertical" style={{width: "100%"}}>
            <Typography level={5}>{label}</Typography>
            <AntSelect
                value={componentValue}
                options={options}
                showSearch
                onChange={handleChange}
            />
        </Space>
    );
};

export class Menu extends MosaicClient {
    /**
     * Create a new menu input.
     * @param {object} [options] Options object
     * @param {HTMLElement} [options.element] The parent DOM element in which to
     *  place the menu elements. If undefined, a new `div` element is created.
     * @param {Selection} [options.filterBy] A selection to filter the database
     *  table indicated by the *from* option.
     * @param {Param} [options.as] The output param or selection. A selection
     *  clause is added for the currently selected menu option.
     * @param {string} [options.field] The database column name to use within
     *  generated selection clause predicates. Defaults to the *column* option.
     * @param {(any | { value: any, label?: string })[]} [options.options] An
     *  array of menu options, as literal values or option objects. Option
     *  objects have a `value` property and an optional `label` property. If no
     *  label or *format* function is provided, the string-coerced value is used.
     * @param {(value: any) => string} [options.format] A format function that
     *  takes an option value as input and generates a string label. The format
     *  function is not applied when an explicit label is provided in an option
     *  object.
     * @param {*} [options.value] The initial selected menu value.
     * @param {string} [options.from] The name of a database table to use as a data
     *  source for this widget. Used in conjunction with the *column* option.
     * @param {string} [options.column] The name of a database column from which
     *  to pull menu options. The unique column values are used as menu options.
     *  Used in conjunction with the *from* option.
     * @param {string} [options.label] A text label for this input.
     */
    constructor({
                    element,
                    filterBy,
                    from,
                    column,
                    label = column,
                    format = x => x, // TODO
                    options,
                    value,
                    field = column,
                    as
                } = {}) {
        super(filterBy);
        this.from = from;
        this.column = column;
        this.format = format;
        this.field = field;
        const selection = this.selection = as;

        // New this
        this.value = value;
        this.label = label;

        this.element = element ?? document.createElement('div');
        this.root = ReactDOM.createRoot(this.element);

        // if provided, populate menu options
        if (options) {
            this.data = options.map(value => isObject(value) ? value : {value});
            this.selectedValue(this.value ?? '');
            this.update();
        }

        // initialize selection or param bindings
        if (selection) {
            const isParam = !isSelection(selection);

            // publish any initial menu value to the selection/param
            // later updates propagate this back to the menu element
            // do not publish if using a param that already has a value
            if (value != null && (!isParam || selection.value === undefined)) {
                this.publish(value);
            }

            // if bound to a scalar param, respond to value updates
            if (isParam) {
                this.selection.addEventListener('value', value => {
                    if (value !== this.value) {
                        this.selectedValue(value);
                    }
                });
            }
        }
    }

    selectedValue(value) {
        const index = this.data?.findIndex(opt => opt.value === value);
        if (index >= 0) {
            this.value = this.data[index].value
        } else {
            this.value = String(value)
        }
    }

    reset() {
        this.selectedValue(this.from ? 0 : -1);
    }

    publish(value) {
        const {selection, field} = this;
        if (isSelection(selection)) {
            if (value === '') value = undefined; // 'All' option
            const clause = clausePoint(field, value, {source: this});
            selection.update(clause);
        } else if (isParam(selection)) {
            selection.update(value);
        }
    }

    query(filter = []) {
        const {from, column} = this;
        if (!from) return null;
        return Query
            .from(from)
            .select({value: column})
            .distinct()
            .where(filter)
            .orderby(column)
    }

    queryResult(data) {
        // column option values, with an inserted 'All' value
        this.data = [{value: '', label: 'All'}, ...data];
        return this;
    }

    update() {
        const {data, selection} = this;
        const formattedOptions = data.map(option => ({
            value: option.value,
            label: option.label || option.value
        }));

        if (selection) {
            if (isSelection(selection)) {
                this.selectedValue(selection.valueFor(this) ?? '');
            } else {
                this.selectedValue(selection.value ?? '');
            }
        }
        this.root.render(<ShapeletsSelect
            value={this.value}
            label={this.label}
            options={formattedOptions}
            onAction={this.handleAction.bind(this)}
        />);

        return this;
    }

    handleAction(value) {
        this.publish(value)
    }

}
