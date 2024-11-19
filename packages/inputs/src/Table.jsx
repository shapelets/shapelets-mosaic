import {coordinator, MosaicClient, toDataColumns} from '@uwdata/mosaic-core';
import {column, desc, Query} from '@uwdata/mosaic-sql';
import {input} from './input.js';
import * as React from "react";
import ReactDOM from 'react-dom/client';
import {Space, Table as AntTable, Typography} from 'antd';

let _id = -1;

/**
 * Creates a future object that encapsulates a Promise along with its associated resolve and reject functions.
 *
 * This function facilitates the integration of a Promise into the Shapelets Table, ensuring that the values
 * for sorting and scrolling are returned only after the Mosaic component has completed its queries and updated
 * the component accordingly. Once the update is complete, the Promise is resolved, providing the necessary data.
 *
 * @returns {Object} An object containing:
 *   - {Promise} promise - The Promise that can be resolved or rejected.
 *   - {Function} resolve - A function to resolve the Promise.
 *   - {Function} reject - A function to reject the Promise.
 *
 */
function createFuture() {
    let resolveFn, rejectFn;
    const promise = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });
    return {promise, resolve: resolveFn, reject: rejectFn};
}

export const table = options => input(Table, options);

/**
 * ShapeletsTable enhances the visualization of Mosaic Table by leveraging the Mosaic engine while rendering an AntD table.
 * This component improves upon the standard table by incorporating features such as asynchronous data loading,
 * infinite scrolling, and sorting capabilities.
 *
 * @param {string} key - A unique identifier for the component.
 * @param {Array} columns - An array of column definitions that specify the structure and content of the table.
 * @param {Array} data - The initial dataset used to populate the table, formatted to comply with AntD specifications.
 * @param {Function} onAction - A function that retrieves additional data when invoked, particularly useful for infinite scrolling.
 *                              The Mosaic component manages the offset for fetching the next batch of data.
 * @param {boolean} loaded - A flag indicating whether all data for the table has been loaded, which determines if further scrolling is necessary.
 * @param {number} maxWidth - The maximum allowable width of the table.
 * @param {number} maxHeight - The maximum allowable height of the table.
 * @param {Function} sortFn - A function responsible for sorting the table data based on specified criteria.
 * @param {Promise} promise - A promise that resolves to the initial dataset for the table.
 *
 */
const ShapeletsTable = ({key, columns, data, onAction, loaded, maxWidth, maxHeight, sortFn, promise}) => {
    const [tableData, setTableData] = React.useState(data ? [...data] : []);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        async function loadData() {
            setLoading(true)
            setTableData(await promise)
            setLoading(false)
        }

        loadData()
    }, [promise]);

    const handleOnScroll = (e) => {
        // Detect when the user has scrolled near the bottom of the table and to trigger a request for more data if the
        // table is not fully loaded.
        if (!loaded) {
            const {scrollTop, clientHeight, scrollHeight} = e.target;
            // Checks if the user has scrolled to within 95% of the total scrollable height
            if (scrollTop + clientHeight >= scrollHeight * 0.95 && !loading) {
                setLoading(true)
                const moreData = onAction();
                moreData.then((x) => {
                    setTableData(prevTableData => [...prevTableData, ...x])
                    setLoading(false)
                })
            }
        }
    };

    const handleSorting = (pagination, filters, sorter) => {
        const {field, order} = sorter;
        setLoading(true)
        const sortedData = sortFn(field, order)
        sortedData.then((x) => {
            setTableData(x);
            setLoading(false)
        })
    };

    return (
        <Typography>
                <Space size='small' direction="horizontal" style={{marginRight: '8px', rowGap: 0}}>
                    <AntTable
                        key={key}
                        bordered={true}
                        showHeader={true}
                        size={'small'}
                        columns={columns}
                        dataSource={tableData}
                        scroll={{
                            x: 'max-content',
                            y: 50 * 5,
                        }}
                        pagination={false}
                        onScroll={handleOnScroll}
                        style={{
                            maxWidth: maxWidth,
                            maxHeight: maxHeight,
                        }}
                        tableLayout='fixed'
                        onChange={handleSorting}
                        showSorterTooltip={{ target: 'sorter-icon' }}/>
            </Space>
        </Typography>        
    );
};

/**
 * Create a new Table instance.
 * @param {object} options Options object
 */
export class Table extends MosaicClient {
    constructor({
                    element,
                    filterBy,
                    from,
                    columns = ['*'],
                    align = {},
                    format,
                    width,
                    maxWidth,
                    height = 500,
                    rowBatch = 25,
                    as
                } = {}) {
        super(filterBy);
        this.id = `table-${++_id}`;
        this.from = from;
        this.columns = columns;
        this.format = format;
        this.align = align;
        this.widths = typeof width === 'object' ? width : {};

        this.offset = 0;
        this.limit = +rowBatch;
        this.pending = false;

        this.selection = as;
        this.currentRow = -1;

        this.sortColumn = null;
        this.sortDesc = false;

        // New this
        this.columns_final = [];
        this.data_final = [];
        this.maxWidth = maxWidth ? `${maxWidth}px` : '100%'
        this.height = `${height}px`

        this.element = element ?? document.createElement('div');
        this.root = ReactDOM.createRoot(this.element);
    }

    requestData(offset = 0) {
        this.offset = offset;
        // Request next data batch
        const query = this.query(this.filterBy?.predicate(this));
        this.requestQuery(query);
        // Prefetch subsequent data batch
        coordinator().prefetch(query.clone().offset(offset + this.limit));
    }

    fields() {
        return this.columns.map(name => column(this.from, name));
    }

    fieldInfo(info) {
        this.schema = info;
        this.future = createFuture()
        this.columns_final = info.map(item => {
            const tpe = item.type;
            return ({
                title: item.column,
                dataIndex: item.column,
                key: item.column,
                width: this.widths[item.column] || 100,
                align: this.align[item.column] || tpe === 'number' ? 'right' : 'left',
                // Set sorter so the icons are shown.
                sorter: true
            });
        });
        this.root.render(<ShapeletsTable
            key={this.id}
            columns={this.columns_final}
            data={this.data_final}
            loaded={this.loaded}
            maxWidth={this.maxWidth}
            maxHeight={this.height}
            onAction={this.handleAction.bind(this)}
            sortFn={this.handleSorting.bind(this)}
            promise={this.future.promise}
        />);
        return this;
    }

    query(filter = []) {
        const {from, limit, offset, schema, sortColumn, sortDesc} = this;
        return Query.from(from)
            .select(schema.map(s => s.column))
            .where(filter)
            .orderby(sortColumn ? (sortDesc ? desc(sortColumn) : sortColumn) : [])
            .limit(limit)
            .offset(offset);
    }

    queryResult(data) {
        if (!this.pending) {
            // data is not from an internal request, so reset table
            this.loaded = false;
            this.data_final = [];
            this.data = [];
            this.offset = 0;
        }
        this.data.push(toDataColumns(data));
        return this;
    }

    transformData() {
        // Transform data to AntD style.
        const {data, schema, offset} = this;
        const nf = schema.length;
        const n = data.length - 1;
        const colNames = this.fields().map(field => field.column)
        const {numRows, columns} = data[n];
        const cols = schema.map(s => columns[s.column]);
        // Clear data before update
        this.data_final = []
        for (let i = 0; i < numRows; ++i) {
            const data = {
                key: offset + i
            }
            for (let j = 0; j < nf; ++j) {
                const value = cols[j][i];
                data[colNames[j]] = value
            }
            this.data_final.push(data)
        }
    }

    update() {
        const {data, limit} = this;
        const n = data.length - 1;
        const {numRows} = data[n];
        this.transformData()
        if (numRows < limit) {
            // Data table has been fully loaded
            this.loaded = true;
        }
        if (!this.future) {
            this.future = createFuture();
            this.root.render(<ShapeletsTable
                key={this.id}
                columns={this.columns_final}
                data={this.data_final}
                loaded={this.loaded}
                maxWidth={this.maxWidth}
                maxHeight={this.height}
                onAction={this.handleAction.bind(this)}
                sortFn={this.handleSorting.bind(this)}
                promise={this.future.promise}
            />);
        }
        this.future.resolve(this.data_final);
        this.future = null;

        this.pending = false;
        return this;
    }

    handleAction() {
        this.pending = true;
        this.requestData(this.offset + this.limit);
        this.future = createFuture()
        return this.future.promise
    }

    handleSorting(columnName, sorting) {
        this.pending = true;
        this.sortDesc = sorting === "descend" ? true : false;
        this.sortColumn = columnName;
        this.requestData()
        this.future = createFuture()
        return this.future.promise
    }
}