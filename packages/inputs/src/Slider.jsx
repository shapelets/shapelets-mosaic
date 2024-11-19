import {clauseInterval, clausePoint, isParam, isSelection, MosaicClient, Param} from '@uwdata/mosaic-core';
import {max, min, Query} from '@uwdata/mosaic-sql';
import {input} from './input.js';
import {Slider as AntSlider, Flex, Space, Typography} from 'antd';
import ReactDOM from "react-dom/client";
import * as React from "react";

let _id = 0;

export const slider = options => input(Slider, options);

const ShapeletsSlider = ({range, key, value, label, width, min, max, step, onAction}) => {
    const [componentValue, setComponentValue] = React.useState(value);

    const handleChange = (value) => {
        onAction(value);
        setComponentValue(value)
    };

    return (
            <Space size='small' direction="horizontal" style={{marginRight: '8px', rowGap: 0}}>
                <Typography.Text strong>{label}</Typography.Text>
                {range ? (
                    <AntSlider
                        range
                        keyboard
                        key={key}
                        value={componentValue}
                        min={min}
                        max={max}
                        step={step}
                        style={{width: width ?? 100}}
                        onChange={handleChange}
                    />
                ) : (
                    <AntSlider
                        key={key}
                        keyboard
                        value={componentValue}
                        min={min}
                        max={max}
                        step={step}
                        style={{width: width ?? 100}}
                        onChange={handleChange}
                    />
                )}
            </Space>
    );
};

export class Slider extends MosaicClient {
    /**
     * Create a new slider input.
     * @param {object} [options] Options object
     * @param {HTMLElement} [options.element] The parent DOM element in which to
     *  place the slider elements. If undefined, a new `div` element is created.
     * @param {Selection} [options.filterBy] A selection to filter the database
     *  table indicated by the *from* option.
     * @param {Param} [options.as] The output param or selection. A selection
     *  clause is added based on the currently selected slider option.
     * @param {string} [options.field] The database column name to use within
     *  generated selection clause predicates. Defaults to the *column* option.
     * @param {'point' | 'interval'} [options.select] The type of selection clause
     *  predicate to generate if the **as** option is a Selection.  If `'point'`
     *  (the default), the selection predicate is an equality check for the slider
     *  value. If `'interval'`, the predicate checks an interval from the minimum
     *  to the current slider value.
     * @param {number} [options.min] The minimum slider value.
     * @param {number} [options.max] The maximum slider value.
     * @param {number} [options.step] The slider step, the amount to increment
     *  between consecutive values.
     * @param {number} [options.value] The initial slider value.
     * @param {string} [options.from] The name of a database table to use as a data
     *  source for this widget. Used in conjunction with the *column* option.
     *  The minimum and maximum values of the column determine the slider range.
     * @param {string} [options.column] The name of a database column whose values
     *  determine the slider range. Used in conjunction with the *from* option.
     *  The minimum and maximum values of the column determine the slider range.
     * @param {string} [options.label] A text label for this input.
     * @param {number} [options.width] The width of the slider in screen pixels.
     */
    constructor({
                    element,
                    filterBy,
                    as,
                    min,
                    max,
                    step,
                    from,
                    column,
                    label = column,
                    value = as?.value,
                    select = 'point',
                    field = column,
                    width
                } = {}) {
        super(filterBy);
        this.id = 'slider_' + (++_id);
        this.from = from;
        this.column = column || 'value';
        this.selection = as;
        this.selectionType = select;
        this.field = field;
        this.min = min;
        this.max = max;
        this.step = step;

        // New this
        this.value = value
        this.range = this.selectionType == 'interval'

        this.element = element ?? document.createElement('div');
        this.root = ReactDOM.createRoot(this.element);

        this.root.render(<ShapeletsSlider
            range={this.range}
            key={this.id}
            value={this.value}
            label={label}
            width={`${width??100}px`}
            min={this.min}
            max={this.max}
            step={this.step}
            onAction={this.handleAction.bind(this)}
        />);

        // track param updates
        if (this.selection && !isSelection(this.selection)) {
            this.selection.addEventListener('value', value => {
                if (value !== +this.value) {
                    this.value = value;
                }
            });
        }
    }

    query(filter = []) {
        const {from, column} = this;
        if (!from || (this.min != null && this.max != null)) return null;
        return Query
            .select({min: min(column), max: max(column)})
            .from(from)
            .where(filter);
    }

    queryResult(data) {
        const {min, max} = Array.from(data)[0];
        if (this.min == null) {
            this.min = min;
        }
        if (this.max == null) {
            this.max = max;
        }
        if (this.step == null) {
            this.step = (max - min) / 500;
        }
        return this;
    }

    publish(value) {
        const {field, selectionType, selection} = this;
        if (isSelection(selection)) {
            if (selectionType === 'interval') {
                /** @type {[number, number]} */
                const domain = [this.min ?? 0, value];
                selection.update(clauseInterval(field, domain, {
                    source: this,
                    bin: 'ceil',
                    scale: {type: 'identity', domain},
                    pixelSize: this.step
                }));
            } else {
                selection.update(clausePoint(field, value, {source: this}));
            }
        } else if (isParam(this.selection)) {
            selection.update(value);
        }
    }

    handleAction(value) {
        this.value = value
        this.publish(value)
    }

}
