import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { UpdateCustomerProfileDto, ChangePasswordDto } from './dto';
export declare class CustomersService {
    private customerRepository;
    constructor(customerRepository: Repository<Customer>);
    findById(customerId: string): Promise<Customer>;
    findByEmail(email: string): Promise<Customer | null>;
    getProfile(customerId: string): Promise<Customer>;
    updateProfile(customerId: string, dto: UpdateCustomerProfileDto): Promise<Customer>;
    changePassword(customerId: string, dto: ChangePasswordDto): Promise<void>;
    deactivateAccount(customerId: string): Promise<void>;
    findAll(): Promise<Customer[]>;
    blockCustomer(customerId: string, block: boolean): Promise<Customer>;
}
