import {
    useCallback,
    useEffect,
} from 'react';
import { useParams } from 'react-router';
import {
    BlockLoading,
    Button,
    Container,
    InputSection,
    ListView,
    NumberInput,
    RadioInput,
    TextArea,
    TextInput,
} from '@ifrc-go/ui';
import {
    isDefined,
    isNotDefined,
} from '@togglecorp/fujs';
import {
    createSubmitHandler,
    getErrorObject,
    type ObjectSchema,
    type PartialForm,
    removeNull,
    requiredStringCondition,
    useForm,
} from '@togglecorp/toggle-form';

import NonFieldError from '#components/NonFieldError';
import {
    type CapacityAndResourceCreateInput,
    type CapacityAndResourceUpdateInput,
    useCapacityAndResourceDetailQuery,
    useCreateCapacityAndResourceMutation,
    useUpdateCapacityAndResourceMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    labelSelector,
    statusOptions,
    transformToFormError,
    valueSelector,
} from '#utils/common';

type PartialFormType = PartialForm<CapacityAndResourceCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

const capacityAndResourceSchema: FormSchema = {
    fields: (): FormSchemaFields => ({
        title: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
        description: {},
        isActive: {},
        order: {
            required: true,
        },
    }),
};

const defaultFormValue: PartialFormType = {
    isActive: false,
};

function CapacityAndResourcesForm() {
    const { id } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(capacityAndResourceSchema, { value: defaultFormValue });

    const [{ data, fetching: detailFetching }] = useCapacityAndResourceDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const [
        { fetching: createPending },
        createCapacityAndResource,
    ] = useCreateCapacityAndResourceMutation();
    const [
        { fetching: updatePending },
        updateCapacityAndResource,
    ] = useUpdateCapacityAndResourceMutation();

    const pending = createPending || updatePending || detailFetching;

    const handleCreate = useCallback(async (mutationData: PartialFormType) => {
        const createPayload = removeNull(mutationData) as CapacityAndResourceCreateInput;
        const res = await createCapacityAndResource({ data: createPayload });
        const result = res.data?.createCapacityAndResource;

        if (isDefined(result) && result.ok) {
            navigate('capacityAndResources');
            alert.show('Resource created successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [createCapacityAndResource, navigate, alert, setError]);

    const handleUpdate = useCallback(async (mutationData: PartialFormType) => {
        if (isNotDefined(id)) {
            return;
        }
        const updatePayload = {
            ...removeNull(mutationData),
            description: mutationData.description ?? null,
        } as CapacityAndResourceUpdateInput;
        const res = await updateCapacityAndResource({ id, data: updatePayload });
        const result = res.data?.updateCapacityAndResource;

        if (isDefined(result) && result.ok) {
            navigate('capacityAndResources');
            alert.show('Resource updated successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [updateCapacityAndResource, id, navigate, alert, setError]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdate : handleCreate,
        )(),
        [validate, setError, id, handleUpdate, handleCreate],
    );

    const handleCancel = useCallback(() => {
        navigate('capacityAndResources');
    }, [navigate]);

    const error = getErrorObject(formError);

    useEffect(() => {
        if (isNotDefined(data?.capacityAndResource)) {
            return;
        }
        setValue(removeNull(data.capacityAndResource));
    }, [data, setValue]);

    if (detailFetching) {
        return (
            <BlockLoading
                withoutBorder
                compact
                message="Loading"
            />
        );
    }

    return (
        <Container
            heading={isDefined(id) ? 'Edit Capacity & Resource' : 'Create Capacity & Resource'}
            headerDescription={isDefined(id)
                ? 'Manage and update the capacity and resource'
                : 'Create a new capacity and resource'}
            withPadding
            footerActions={(
                <ListView>
                    <Button
                        name={undefined}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        name={undefined}
                        onClick={handleFormSubmit}
                        styleVariant="filled"
                        disabled={pending}
                    >
                        Save
                    </Button>
                </ListView>
            )}
        >
            <ListView layout="block">
                <NonFieldError
                    error={formError}
                    withFallbackError
                />
                <InputSection
                    title="Title"
                    description="Enter the title name of the capacity and resource"
                    withAsteriskOnTitle
                >
                    <TextInput
                        name="title"
                        value={value.title}
                        onChange={setFieldValue}
                        error={error?.title}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="Description"
                    description="Enter the description about the capacity and resource"
                >
                    <TextArea
                        name="description"
                        value={value.description}
                        onChange={setFieldValue}
                        error={error?.description}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="Status"
                    description="Choose if the capacity and resource is to be active or inactive"
                >
                    <RadioInput
                        name="isActive"
                        value={value.isActive}
                        onChange={setFieldValue}
                        options={statusOptions}
                        keySelector={valueSelector}
                        labelSelector={labelSelector}
                        error={error?.isActive}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="Order"
                    description="Enter the order in which the capacity and resource should appear"
                    withAsteriskOnTitle
                >
                    <NumberInput
                        name="order"
                        value={value.order}
                        onChange={setFieldValue}
                        error={error?.order}
                        disabled={pending}
                    />
                </InputSection>
            </ListView>
        </Container>
    );
}

export default CapacityAndResourcesForm;
