import {
    useCallback,
    useMemo,
} from 'react';
import { AddFillIcon } from '@ifrc-go/icons';
import {
    Button,
    Container,
    Pager,
    Table,
} from '@ifrc-go/ui';
import {
    createElementColumn,
    createStringColumn,
} from '@ifrc-go/ui/utils';
import { isDefined } from '@togglecorp/fujs';

import EditDeleteActions, { type Props as EditDeleteActionsProps } from '#components/EditDeleteActions';
import StatusCell from '#components/StatusCell';
import {
    AdminAreaLevel,
    DashboardPage,
    type ExternalDashboardFilter,
    Ordering,
    type PreparednessExternalDashboardsQuery,
    usePreparednessDeleteExternalDashboardMutation,
    usePreparednessExternalDashboardsQuery,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useDashboardReorder from '#hooks/useDashboardReorder';
import useFilterState from '#hooks/useFilterState';
import useRegionMap from '#hooks/useRegionMap';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    getErrorMessage,
    idSelector,
} from '#utils/common';
import createDragHandleColumn from '#utils/table';

import PreparednessFilter from './PreparednessFilter';

type PreparednessListItem = NonNullable<NonNullable<PreparednessExternalDashboardsQuery['externalDashboards']>['results'][number]> & { no: string };

export interface PreparednessFilterType extends Omit<ExternalDashboardFilter, 'isActive'> {
    isActive: string | undefined;
}

const defaultFilter: PreparednessFilterType = {
    isActive: undefined,
    page: undefined,
    search: undefined,
    regions: undefined,
};

function PreparednessList() {
    const {
        filter,
        rawFilter,
        filtered,
        setFilterField,
        resetFilter,
        page,
        setPage,
        limit,
        offset,
    } = useFilterState({
        filter: defaultFilter,
    });

    const alert = useAlert();
    const navigate = useRouting();

    const regionMap = useRegionMap(AdminAreaLevel.Region);

    const queryVariables = useMemo(() => ({
        pagination: {
            limit,
            offset,
        },
        filters: {
            isActive: isDefined(filter.isActive) ? filter.isActive === 'true' : undefined,
            search: filter.search || undefined,
            regions: filter.regions?.length ? filter.regions : undefined,
            AND: {
                page: DashboardPage.EmergencyAlerts,
                OR: {
                    page: DashboardPage.DisasterResponse,
                },
            },
            page: filter.page ?? null,
        },
        ordering: [{ order: Ordering.Asc }, { title: Ordering.Asc }],
    }), [limit, offset, filter]);

    const [{ fetching, data }, reExecuteQuery] = usePreparednessExternalDashboardsQuery({
        variables: queryVariables,
    });
    const [, deleteExternalDashboard] = usePreparednessDeleteExternalDashboardMutation();

    const serverData: PreparednessListItem[] = useMemo(() => (
        (data?.externalDashboards?.results ?? []).map((dashboard, index) => ({
            ...dashboard,
            no: String((page - 1) * limit + index + 1),
        }))
    ), [page, data, limit]);

    const handleReorderSuccess = useCallback(() => {
        reExecuteQuery({ requestPolicy: 'network-only' });
    }, [reExecuteQuery]);

    const { tableData, rowModifier } = useDashboardReorder(
        serverData,
        page,
        limit,
        handleReorderSuccess,
    );

    const handleDeleteClick = useCallback(
        (id: string) => {
            deleteExternalDashboard({ id }).then((resp) => {
                const result = resp.data?.deleteExternalDashboard;
                if (result?.ok) {
                    if (tableData.length === 1 && page > 1) {
                        setPage(page - 1);
                    } else {
                        reExecuteQuery({ requestPolicy: 'network-only' });
                    }
                    alert.show('Dashboard deleted successfully', { variant: 'success' });
                } else {
                    alert.show(getErrorMessage(resp.error, result?.errors), { variant: 'danger' });
                }
            }).catch(() => {
                alert.show(errorMessage, { variant: 'danger' });
            });
        },
        [deleteExternalDashboard, reExecuteQuery, alert, tableData.length, page, setPage],
    );

    const columns = useMemo(() => [
        createDragHandleColumn<PreparednessListItem>(),
        createStringColumn<PreparednessListItem, string | number>(
            'no',
            'No.',
            (item) => item.no,
        ),
        createStringColumn<PreparednessListItem, string | number>(
            'title',
            'Title',
            (item) => item.title,
        ),
        createStringColumn<PreparednessListItem, string | number>(
            'operation',
            'Operation',
            (item) => item.pageDisplay,
        ),
        createStringColumn<PreparednessListItem, string | number>(
            'region',
            'Region',
            (item) => (isDefined(item.regionId) ? regionMap[item.regionId] : '-'),
        ),
        createElementColumn<PreparednessListItem, string | number, { isActive: boolean }>(
            'status',
            'Status',
            StatusCell,
            (_, datum) => ({
                isActive: datum.isActive,
            }),
        ),
        createElementColumn<PreparednessListItem, string | number, EditDeleteActionsProps>(
            'actions',
            '',
            EditDeleteActions,
            (_, datum) => ({
                id: datum.id,
                onDelete: handleDeleteClick,
                itemTitle: datum.title,
                to: 'editPreparedness',
            }),
            { columnWidth: 150 },
        ),
    ], [handleDeleteClick, regionMap]);

    const handleCreateClick = useCallback(() => {
        navigate('createPreparedness');
    }, [navigate]);

    return (
        <Container
            withPadding
            heading="Preparedness"
            filters={(
                <PreparednessFilter
                    value={rawFilter}
                    onChange={setFilterField}
                    filtered={filtered}
                    onReset={resetFilter}
                />
            )}
            headerDescription="Track, organize, and update preparedness dashboards"
            headerActions={(
                <Button
                    name={undefined}
                    onClick={handleCreateClick}
                    before={(<AddFillIcon />)}
                    styleVariant="filled"
                >
                    Create
                </Button>
            )}
            footerActions={(
                <Pager
                    activePage={page}
                    itemsCount={data?.externalDashboards?.totalCount ?? 0}
                    maxItemsPerPage={limit}
                    onActivePageChange={setPage}
                />
            )}
        >
            <Table
                keySelector={idSelector}
                columns={columns}
                data={tableData}
                filtered={filtered}
                pending={fetching}
                rowModifier={rowModifier}
            />
        </Container>
    );
}

export default PreparednessList;
