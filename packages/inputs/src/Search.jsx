import {clauseMatch, isParam, isSelection, MosaicClient} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import {input} from './input.js';
import * as React from "react";
import ReactDOM from 'react-dom/client';
import {Select as AntSelect, Space, Typography} from 'antd';


let _id = 0;

export const search = options => input(Search, options);

const ShapeletsSearch = ({key, label, options, value, onAction, onSearch}) => {
    const [selectOptions, setSelectOptions] = React.useState([...options]);
    const [componentValue, setComponentValue] = React.useState(value);

    const handleSearch = (newValue) => {
        const newList = newValue ? onSearch(newValue) : [...options]
        setSelectOptions(newList)
    };

    const handleClear = () => {
        onAction('');
        setComponentValue('');
        setSelectOptions([])
    };

    const handleChange = (selectedValue) => {
        onAction(selectedValue);
        setComponentValue(selectedValue);
    };

    return (
        <Space size='small' direction="horizontal" style={{marginRight: '8px', rowGap: 0}}>
            <Typography.Text strong>{label}</Typography.Text>
            <AntSelect
                key={key}
                value={componentValue}
                options={selectOptions}
                onSearch={handleSearch}
                onClear={handleClear}
                showSearch
                onChange={handleChange}
                filterOption={false}
                allowClear={true}
                suffixIcon={null}
                style={{minWidth: 150}}
                placeholder='Query'
            />
        </Space>
    );
};

export class Search extends MosaicClient {
    /**
     * Create a new text search input.
     * @param {object} [options] Options object
     * @param {HTMLElement} [options.element] The parent DOM element in which to
     *  place the search elements. If undefined, a new `div` element is created.
     * @param {Selection} [options.filterBy] A selection to filter the database
     *  table indicated by the *from* option.
     * @param {Param} [options.as] The output param or selection. A selection
     *  clause is added based on the current text search query.
     * @param {string} [options.field] The database column name to use within
     *  generated selection clause predicates. Defaults to the *column* option.
     * @param {'contains' | 'prefix' | 'suffix' | 'regexp'} [options.type] The
     *  type of text search query to perform. One of:
     *  - `"contains"` (default): the query string may appear anywhere in the text
     *  - `"prefix"`: the query string must appear at the start of the text
     *  - `"suffix"`: the query string must appear at the end of the text
     *  - `"regexp"`: the query string is a regular expression the text must match
     * @param {string} [options.from] The name of a database table to use as an
     *  autocomplete data source for this widget. Used in conjunction with the
     *  *column* option.
     * @param {string} [options.column] The name of a database column from which
     *  to pull valid search results. The unique column values are used as search
     *  autocomplete values. Used in conjunction with the *from* option.
     * @param {string} [options.label] A text label for this input.
     */
    constructor({
                    element,
                    filterBy,
                    from,
                    column,
                    label,
                    type = 'contains',
                    field = column,
                    as
                } = {}) {
        super(filterBy);
        this.id = 'search_' + (++_id);
        this.type = type;
        this.from = from;
        this.column = column;
        this.selection = as;
        this.field = field;

        // New this
        this.label = label;
        this.value = null;
        this.options = [];

        this.element = element ?? document.createElement('div');
        this.root = ReactDOM.createRoot(this.element);

        if (this.selection) {
            if (!isSelection(this.selection)) {
                this.selection.addEventListener('value', value => {
                    if (value !== this.value) {
                        this.value = value;
                    }
                });
            }
        }
    }

    reset() {
        this.value = '';
    }

    publish(value) {
        const {selection, field, type} = this;
        if (isSelection(selection)) {
            const clause = clauseMatch(field, value, {source: this, method: type});
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
            .select({list: column})
            .distinct()
            .where(filter);
    }

    queryResult(data) {
        this.data = data;
        this.options = []
        for (const d of this.data) {
            this.options.push({value: d.list, label: d.list})
        }
        return this;
    }

    update() {
        const formattedOptions = this.options.map(option => ({
            value: option.value,
            label: option.label || option.value
        }));
        this.root.render(<ShapeletsSearch
            key={this.id}
            value={this.value}
            label={this.label}
            options={formattedOptions}
            onAction={this.handleAction.bind(this)}
            onSearch={this.handleOnSearch.bind(this)}
        />);

        return this;
    }

    handleAction(value) {
        this.publish(value)
    }

    handleOnSearch(value) {
        // Apply filter for searching value.
        const filteredOptions = this.options.filter(option =>
            option.label.toLowerCase().includes(value.toLowerCase())
        );
        const formattedOptions = filteredOptions.map(option => ({
            value: option.value,
            label: option.label || option.value
        }));
        return formattedOptions
    }
}
